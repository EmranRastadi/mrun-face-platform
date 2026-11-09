"""Unit tests for ICE URL parsing and STUN response parsing."""

import struct

import pytest

from src.webrtc.ice import (
    STUN_COOKIE,
    parse_ice_url,
    probe_stun_urls,
    probe_turn_urls,
)


def test_parse_stun_url_default_port():
    parsed = parse_ice_url("stun:stun.example.com")
    assert parsed.scheme == "stun"
    assert parsed.host == "stun.example.com"
    assert parsed.port == 3478
    assert parsed.is_turn is False


def test_parse_turn_url_with_transport():
    parsed = parse_ice_url("turn:turn.example.com:3478?transport=tcp")
    assert parsed.scheme == "turn"
    assert parsed.host == "turn.example.com"
    assert parsed.port == 3478
    assert parsed.transport == "tcp"
    assert parsed.is_turn is True


def test_parse_turns_default_port():
    parsed = parse_ice_url("turns:turn.example.com")
    assert parsed.port == 5349
    assert parsed.transport == "udp"


def test_parse_ipv6_url():
    parsed = parse_ice_url("stun:[2001:db8::1]:3479")
    assert parsed.host == "2001:db8::1"
    assert parsed.port == 3479


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "stun:",
        "stun:example.com:not-a-port",
        "turn:example.com?transport=sctp",
    ],
)
def test_parse_invalid_url(url):
    with pytest.raises(ValueError):
        parse_ice_url(url)


def test_probe_reports_unreachable_for_invalid_url():
    [result] = probe_stun_urls(["not-a-url"])
    assert result["reachable"] is False
    assert "error" in result


def test_probe_skips_turn_url_for_stun_probe():
    [result] = probe_stun_urls(["turn:127.0.0.1:3478"])
    assert result["skipped"] == "not a STUN URL"


def test_probe_skips_stun_url_for_turn_probe():
    [result] = probe_turn_urls(["stun:127.0.0.1:3478"])
    assert result["skipped"] == "not a TURN URL"


def test_stun_cookie_constant():
    assert struct.pack("!I", STUN_COOKIE) == b"\x21\x12\xa4\x42"
