"""HTTP + WebSocket endpoints for WebRTC connectivity testing."""

from __future__ import annotations

import hmac
import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse
from starlette.websockets import WebSocketState

from .ice import probe_stun_urls, probe_turn_urls
from .settings import (
    build_ice_servers,
    get_webrtc_settings,
    split_urls,
    turn_is_configured,
)
from .signaling import SignalingHub

logger = logging.getLogger("camera-service.webrtc")

router = APIRouter(prefix="/webrtc", tags=["webrtc"])
STATIC_DIR = Path(__file__).resolve().parent / "static"
hub = SignalingHub()

ROOM_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
ROLES = {"camera", "viewer"}
RELAYED_MESSAGE_TYPES = {"offer", "answer", "ice-candidate", "restart"}
MAX_MESSAGE_BYTES = 64 * 1024


def _client_config() -> dict[str, object]:
    settings = get_webrtc_settings()
    stun_urls = split_urls(settings.stun_urls)
    turn_urls = split_urls(settings.turn_urls)

    return {
        "enabled": settings.webrtc_enabled,
        "iceServers": build_ice_servers(settings),
        "iceTransportPolicy": "relay" if settings.webrtc_force_relay else "all",
        "forceRelay": settings.webrtc_force_relay,
        "signalingPath": "/webrtc/signaling",
        "stun": {"configured": bool(stun_urls), "urls": stun_urls},
        "turn": {
            "configured": turn_is_configured(settings),
            "urls": turn_urls,
            "realm": settings.turn_realm,
            "relayPortRange": f"{settings.turn_min_port}-{settings.turn_max_port}",
            "credentialType": "static",
        },
        "testPage": "/webrtc/",
        "diagnostics": "/webrtc/diagnostics",
    }


@router.get("", include_in_schema=False)
def test_page_redirect() -> RedirectResponse:
    return RedirectResponse(url="/webrtc/")


@router.get("/", include_in_schema=False)
def test_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@router.get("/config")
def webrtc_config() -> dict[str, object]:
    """ICE servers the browser should use.

    This endpoint returns TURN credentials because the browser needs them to
    perform an allocation. It never writes credentials to logs. In production,
    replace static credentials with short-lived TURN REST credentials.
    """
    return _client_config()


@router.get("/diagnostics")
def webrtc_diagnostics() -> dict[str, object]:
    settings = get_webrtc_settings()
    stun_urls = split_urls(settings.stun_urls)
    turn_urls = split_urls(settings.turn_urls)

    return {
        "enabled": settings.webrtc_enabled,
        "stun": {
            "configured": bool(stun_urls),
            "results": probe_stun_urls(stun_urls) if settings.webrtc_enabled else [],
        },
        "turn": {
            "configured": turn_is_configured(settings),
            "urlsConfigured": bool(turn_urls),
            "results": probe_turn_urls(turn_urls) if settings.webrtc_enabled else [],
            "relayPortRange": f"{settings.turn_min_port}-{settings.turn_max_port}",
            "note": (
                "The result above only checks TCP reachability. A real TURN "
                "allocation and authentication are proven by a `relay` ICE "
                "candidate in the browser test page."
            ),
        },
    }


@router.websocket("/signaling")
async def signaling(
    websocket: WebSocket,
    room: str = Query(default="mrun-test"),
    peer: str = Query(default=""),
    role: str = Query(default="viewer"),
    token: str | None = Query(default=None),
) -> None:
    settings = get_webrtc_settings()

    if not settings.webrtc_enabled:
        await websocket.close(code=4403, reason="WebRTC is disabled")
        return

    expected_token = settings.webrtc_signaling_token.strip()
    provided_token = token or websocket.headers.get("x-webrtc-token", "")
    if expected_token and not hmac.compare_digest(expected_token, provided_token):
        await websocket.close(code=4401, reason="invalid signaling token")
        return

    if not ROOM_RE.fullmatch(room):
        await websocket.close(code=4400, reason="invalid room")
        return
    if not ROOM_RE.fullmatch(peer):
        await websocket.close(code=4400, reason="invalid peer id")
        return
    if role not in ROLES:
        await websocket.close(code=4400, reason="invalid role")
        return

    await websocket.accept()

    try:
        existing = await hub.register(
            room, peer, role, websocket, settings.webrtc_max_peers_per_room
        )
    except ValueError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=4409, reason=str(exc))
        return

    logger.info("webrtc signaling connected room=%s peer=%s role=%s", room, peer, role)
    await websocket.send_json(
        {"type": "welcome", "peer": peer, "role": role, "peers": existing, "room": room}
    )
    await hub.broadcast(
        room,
        {"type": "peer-joined", "peer": peer, "role": role},
        exclude=peer,
    )

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await websocket.send_json({"type": "error", "message": "message too large"})
                continue

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "invalid JSON"})
                continue

            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "message": "message must be an object"})
                continue

            message_type = message.get("type")
            if message_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if message_type not in RELAYED_MESSAGE_TYPES:
                await websocket.send_json(
                    {"type": "error", "message": f"unsupported message type: {message_type!r}"}
                )
                continue

            payload: dict[str, object] = {
                "type": message_type,
                "from": peer,
                "fromRole": role,
            }
            if isinstance(message.get("sdp"), dict):
                payload["sdp"] = message["sdp"]
            if "candidate" in message:
                payload["candidate"] = message["candidate"]
            if message_type == "restart":
                payload["reason"] = str(message.get("reason", ""))[:200]

            await hub.broadcast(room, payload, exclude=peer)
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        # Starlette raises RuntimeError when the socket is already closed.
        pass
    finally:
        await hub.unregister(room, peer)
        if websocket.application_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except RuntimeError:
                pass
        await hub.broadcast(room, {"type": "peer-left", "peer": peer, "role": role})
        logger.info("webrtc signaling disconnected room=%s peer=%s role=%s", room, peer, role)
