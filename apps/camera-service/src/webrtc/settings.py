"""Configuration for WebRTC/ICE.

Values are read from environment variables (or the repository `.env`), matching
the pydantic-settings convention used by the other FastAPI services.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class WebRTCSettings(BaseSettings):
    """ICE + signaling settings.

    `STUN_URLS` / `TURN_URLS` are comma-separated lists because both the browser
    and the diagnostics endpoint accept more than one endpoint. URLs are exactly
    what the *browser* must be able to reach, not an in-cluster DNS name.
    """

    webrtc_enabled: bool = True

    stun_urls: str = ""
    turn_urls: str = ""
    turn_username: str = ""
    turn_password: str = ""
    turn_realm: str = "mrun.local"

    # TURN relay range is also configured on coturn. It is exposed here for
    # documentation/diagnostics visibility only.
    turn_min_port: int = 49160
    turn_max_port: int = 49200

    webrtc_force_relay: bool = False

    # Optional shared token for the WebSocket signaling endpoint. Empty means
    # "no token" (development default). Production should use the platform JWT
    # or a dedicated signaling auth layer instead.
    webrtc_signaling_token: str = ""

    webrtc_max_peers_per_room: int = 8

    class Config:
        env_file = ".env"
        extra = "ignore"
        case_sensitive = False


def split_urls(value: str) -> list[str]:
    """Split a comma/newline separated URL list and drop empty entries."""
    return [item.strip() for item in value.replace("\n", ",").split(",") if item.strip()]


def turn_is_configured(settings: WebRTCSettings) -> bool:
    return bool(
        split_urls(settings.turn_urls)
        and settings.turn_username.strip()
        and settings.turn_password.strip()
    )


def build_ice_servers(settings: WebRTCSettings) -> list[dict[str, object]]:
    """Build the browser `iceServers` array.

    STUN and TURN are *servers*, not candidates. The browser uses STUN to learn
    its server-reflexive address and TURN to allocate a relay address; the
    resulting candidates are `srflx` and `relay` respectively.
    """
    servers: list[dict[str, object]] = []

    stun_urls = split_urls(settings.stun_urls)
    if stun_urls:
        servers.append({"urls": stun_urls})

    turn_urls = split_urls(settings.turn_urls)
    if turn_urls and turn_is_configured(settings):
        servers.append(
            {
                "urls": turn_urls,
                "username": settings.turn_username,
                "credential": settings.turn_password,
            }
        )

    return servers


@lru_cache(maxsize=1)
def get_webrtc_settings() -> WebRTCSettings:
    return WebRTCSettings()
