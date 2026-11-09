"""Minimal STUN/TURN diagnostics.

This module does not implement ICE or TURN allocation. It only:

* parses `stun:`/`turn:` URLs;
* sends a real RFC 5389 STUN Binding request over UDP and parses the
  XOR-MAPPED-ADDRESS, so STUN reachability is verified rather than assumed;
* performs a TCP reachability check for TURN listeners.

TURN authentication and relay allocation are verified end-to-end by the browser
test page, because only the browser can produce a genuine `relay` candidate.
"""

from __future__ import annotations

import os
import socket
import struct
import time
from collections.abc import Iterable
from dataclasses import dataclass

STUN_COOKIE = 0x2112A442
STUN_BINDING_REQUEST = 0x0001
STUN_BINDING_SUCCESS = 0x0101
ATTR_MAPPED_ADDRESS = 0x0001
ATTR_XOR_MAPPED_ADDRESS = 0x0020


@dataclass(frozen=True)
class IceUrl:
    raw: str
    scheme: str
    host: str
    port: int
    transport: str

    @property
    def is_turn(self) -> bool:
        return self.scheme in {"turn", "turns"}


def parse_ice_url(url: str) -> IceUrl:
    """Parse `stun:host[:port]` / `turn:host[:port]?transport=udp|tcp`."""
    raw = url.strip()
    if ":" not in raw:
        raise ValueError(f"invalid ICE URL: {url!r}")

    scheme, rest = raw.split(":", 1)
    scheme = scheme.lower()
    if scheme not in {"stun", "stuns", "turn", "turns"}:
        raise ValueError(f"unsupported ICE URL scheme: {scheme!r}")

    transport = "udp"
    if "?" in rest:
        rest, query = rest.split("?", 1)
        for pair in query.split("&"):
            key, _, value = pair.partition("=")
            if key.lower() == "transport" and value:
                transport = value.lower()
    if transport not in {"udp", "tcp"}:
        raise ValueError(f"unsupported transport: {transport!r}")

    default_port = 5349 if scheme in {"stuns", "turns"} else 3478

    if rest.startswith("["):  # [IPv6]:port
        closing = rest.find("]")
        if closing == -1:
            raise ValueError(f"invalid IPv6 ICE URL: {url!r}")
        host = rest[1:closing]
        remainder = rest[closing + 1 :]
        port = int(remainder[1:]) if remainder.startswith(":") else default_port
    elif rest.count(":") == 1:
        host, port_text = rest.split(":", 1)
        port = int(port_text)
    else:
        host = rest
        port = default_port

    if not host:
        raise ValueError(f"missing host in ICE URL: {url!r}")
    if not (1 <= port <= 65535):
        raise ValueError(f"invalid port in ICE URL: {url!r}")

    return IceUrl(raw=raw, scheme=scheme, host=host, port=port, transport=transport)


def _parse_mapped_address(value: bytes, transaction_id: bytes) -> tuple[str, int]:
    if len(value) < 8:
        raise ValueError("short mapped-address attribute")
    family = value[1]
    port = struct.unpack("!H", value[2:4])[0] ^ (STUN_COOKIE >> 16)
    if family == 0x01:
        raw_ip = struct.pack("!I", STUN_COOKIE)
        octets = bytes(a ^ b for a, b in zip(value[4:8], raw_ip))
        return socket.inet_ntop(socket.AF_INET, octets), port
    if family == 0x02:
        if len(value) < 20:
            raise ValueError("short IPv6 mapped-address attribute")
        raw_ip = struct.pack("!I", STUN_COOKIE) + transaction_id
        octets = bytes(a ^ b for a, b in zip(value[4:20], raw_ip))
        return socket.inet_ntop(socket.AF_INET6, octets), port
    raise ValueError(f"unsupported address family: {family}")


def _parse_plain_address(value: bytes) -> tuple[str, int]:
    if len(value) < 8:
        raise ValueError("short mapped-address attribute")
    family = value[1]
    port = struct.unpack("!H", value[2:4])[0]
    if family == 0x01:
        return socket.inet_ntop(socket.AF_INET, value[4:8]), port
    if family == 0x02:
        if len(value) < 20:
            raise ValueError("short IPv6 mapped-address attribute")
        return socket.inet_ntop(socket.AF_INET6, value[4:20]), port
    raise ValueError(f"unsupported address family: {family}")


def stun_binding(host: str, port: int, timeout: float = 1.5) -> dict[str, object]:
    """Send a real STUN Binding request and return the mapped address."""
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_DGRAM)
    if not infos:
        raise OSError(f"could not resolve STUN host {host!r}")
    family, _socktype, _proto, _canonname, sockaddr = infos[0]

    transaction_id = os.urandom(12)
    request = struct.pack("!HHI", STUN_BINDING_REQUEST, 0, STUN_COOKIE) + transaction_id
    started = time.perf_counter()

    with socket.socket(family, socket.SOCK_DGRAM) as sock:
        sock.settimeout(timeout)
        sock.sendto(request, sockaddr)
        response, _ = sock.recvfrom(2048)

    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    if len(response) < 20:
        raise ValueError("short STUN response")
    message_type, length, cookie = struct.unpack("!HHI", response[:8])
    if message_type != STUN_BINDING_SUCCESS:
        raise ValueError(f"unexpected STUN message type: 0x{message_type:04x}")
    if cookie != STUN_COOKIE:
        raise ValueError("invalid STUN magic cookie")
    if response[8:20] != transaction_id:
        raise ValueError("STUN transaction id mismatch")

    offset = 20
    end = 20 + length
    while offset + 4 <= end and offset + 4 <= len(response):
        attr_type, attr_length = struct.unpack("!HH", response[offset : offset + 4])
        value = response[offset + 4 : offset + 4 + attr_length]
        if attr_type == ATTR_XOR_MAPPED_ADDRESS:
            address, mapped_port = _parse_mapped_address(value, transaction_id)
            return {
                "address": address,
                "port": mapped_port,
                "rttMs": elapsed_ms,
                "attribute": "XOR-MAPPED-ADDRESS",
            }
        if attr_type == ATTR_MAPPED_ADDRESS:
            address, mapped_port = _parse_plain_address(value)
            return {
                "address": address,
                "port": mapped_port,
                "rttMs": elapsed_ms,
                "attribute": "MAPPED-ADDRESS",
            }
        offset += 4 + attr_length + ((4 - attr_length % 4) % 4)

    raise ValueError("STUN response has no mapped address")


def tcp_reachable(host: str, port: int, timeout: float = 1.5) -> dict[str, object]:
    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {
                "reachable": True,
                "rttMs": round((time.perf_counter() - started) * 1000, 2),
            }
    except OSError as exc:
        return {"reachable": False, "error": str(exc)}


def probe_stun_urls(urls: Iterable[str]) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for url in urls:
        result: dict[str, object] = {"url": url}
        try:
            parsed = parse_ice_url(url)
            if parsed.is_turn:
                result.update({"skipped": "not a STUN URL"})
            else:
                result.update({"reachable": True, **stun_binding(parsed.host, parsed.port)})
        except (ValueError, OSError) as exc:
            result.update({"reachable": False, "error": str(exc)})
        results.append(result)
    return results


def probe_turn_urls(urls: Iterable[str]) -> list[dict[str, object]]:
    """Check TCP reachability only; browser relay candidates prove allocation."""
    results: list[dict[str, object]] = []
    for url in urls:
        result: dict[str, object] = {"url": url}
        try:
            parsed = parse_ice_url(url)
            if not parsed.is_turn:
                result.update({"skipped": "not a TURN URL"})
            else:
                result.update(tcp_reachable(parsed.host, parsed.port))
        except (ValueError, OSError) as exc:
            result.update({"reachable": False, "error": str(exc)})
        results.append(result)
    return results
