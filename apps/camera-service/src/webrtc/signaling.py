"""In-memory WebSocket signaling relay.

The project had no signaling server, so this is the smallest implementation that
supports the built-in connectivity tester. It is *not* a media server: offers,
answers and ICE candidates are relayed between browser peers in the same room.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class Peer:
    peer_id: str
    role: str
    websocket: WebSocket
    joined_at: float = field(default_factory=time.time)
    send_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, payload: dict) -> None:
        async with self.send_lock:
            await self.websocket.send_json(payload)


class SignalingHub:
    """Rooms are process-local; camera-service runs a single replica by default."""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, Peer]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _lock(self, room: str) -> asyncio.Lock:
        if room not in self._locks:
            self._locks[room] = asyncio.Lock()
        return self._locks[room]

    async def register(
        self, room: str, peer_id: str, role: str, websocket: WebSocket, max_peers: int
    ) -> list[dict[str, str]]:
        async with self._lock(room):
            peers = self._rooms.setdefault(room, {})
            if peer_id in peers:
                raise ValueError("peer id is already connected")
            if len(peers) >= max_peers:
                raise ValueError("room is full")
            peers[peer_id] = Peer(peer_id=peer_id, role=role, websocket=websocket)
            return [{"peer": peer.peer_id, "role": peer.role} for peer in peers.values()]

    async def unregister(self, room: str, peer_id: str) -> None:
        async with self._lock(room):
            peers = self._rooms.get(room)
            if not peers:
                return
            peers.pop(peer_id, None)
            if not peers:
                self._rooms.pop(room, None)
                self._locks.pop(room, None)

    async def peers(self, room: str) -> list[Peer]:
        async with self._lock(room):
            return list(self._rooms.get(room, {}).values())

    async def broadcast(self, room: str, payload: dict, exclude: str | None = None) -> None:
        for peer in await self.peers(room):
            if peer.peer_id == exclude:
                continue
            try:
                await peer.send(payload)
            except Exception:  # noqa: BLE001, S112 - best-effort fan-out to disconnected peers
                continue
