"""WebRTC/ICE support for camera-service.

The module is deliberately small: it exposes the browser ICE configuration, a
WebSocket signaling relay for the built-in connectivity tester, and a diagnostics
endpoint that checks the configured STUN/TURN endpoints from the server side.
"""
