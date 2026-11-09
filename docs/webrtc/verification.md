# WebRTC / ICE verification results

Captured on **2026-11-09** on the development host:

| Item | Value |
| --- | --- |
| Host LAN address | `172.20.41.38/24` |
| Docker | 29.9.0, Compose network `mrun-face-platform local stack` (`172.18.0.0/16`) |
| coturn | `coturn/coturn:4.6.2` (Compose profile `webrtc`) |
| camera-service | `uvicorn` on `http://127.0.0.1:8010` |
| Browser | headless Chromium 156.0.8078.47 driven over CDP |
| Chrome flags | `--disable-features=WebRtcHideLocalIpsWithMdns --autoplay-policy=no-user-gesture-required` |

## 1. Services

```text
$ docker compose --profile webrtc ps coturn
NAME          IMAGE                 COMMAND                  SERVICE   STATUS   PORTS
mrun-coturn   coturn/coturn:4.6.2   "docker-entrypoint.s…"   coturn    Up       0.0.0.0:3478->3478/udp, 0.0.0.0:3478->3478/tcp,
                                                                              0.0.0.0:49160-49200->49160-49200/udp
```

## 2. STUN reachability (real Binding request)

`turnutils_stunclient` inside the coturn container:

```text
$ docker compose --profile webrtc exec -T coturn turnutils_stunclient -p 3478 127.0.0.1
0: (36): INFO: IPv4. UDP reflexive addr: 127.0.0.1:35252
exit=0
```

The camera-service diagnostics endpoint sends its own real Binding request and
parses `XOR-MAPPED-ADDRESS`:

```text
$ curl -s http://127.0.0.1:8010/webrtc/diagnostics
{
  "stun": {
    "configured": true,
    "results": [{
      "url": "stun:127.0.0.1:3478",
      "reachable": true,
      "address": "172.18.0.1",
      "port": 45568,
      "rttMs": 1.94,
      "attribute": "XOR-MAPPED-ADDRESS"
    }]
  },
  "turn": {
    "configured": true,
    "results": [
      {"url": "turn:127.0.0.1:3478?transport=udp", "reachable": true, "rttMs": 0.31},
      {"url": "turn:127.0.0.1:3478?transport=tcp", "reachable": true, "rttMs": 0.17}
    ]
  }
}
```

This proves the STUN server replied; it does not yet prove relay allocation.

## 3. TURN authentication and allocation

`turnutils_uclient` with the configured static credentials:

```text
$ docker compose --profile webrtc exec -T coturn turnutils_uclient \
    -u mrun -w change-me-in-development -p 3478 -n 1 -m 1 -y 127.0.0.1
...
15: (41): INFO: start_mclient: tot_send_msgs=4, tot_recv_msgs=0
15: (41): INFO: Total lost packets 4 (100.000000%), total send dropped 0 (0.000000%)
exit=0
```

`tot_send_msgs=4` means the client authenticated and obtained a relay
allocation; the 100% “loss” is expected because no peer was listening on the
target. The definitive proof is the browser relay candidate below.

## 4. Browser run — default (`?auto=1`)

```text
state=media relay=false media=true
camera states: gathering=complete ice=connected connection=connected signaling=stable
viewer states: gathering=complete ice=connected connection=connected signaling=stable

camera candidates: host=1 srflx=1 relay=2
viewer candidates: host=1 srflx=1 relay=0

selected pair:
  state=succeeded nominated=true
  local  = host  udp 172.20.41.38:51080
  remote = host  udp 172.20.41.38:52044
  rtt    = 0.002 s
  bytes  = 84565 received / 2933 sent

media:
  camera outbound: 78708 bytes, 88 packets, 22 frames encoded
  viewer inbound:  78708 bytes, 88 packets, 0 lost, 22 frames decoded, 640x360, jitter 0.004
```

Observed real candidates:

```text
camera
  host   udp 172.20.41.38:52044
  srflx  udp 172.18.0.1:55248   related 172.20.41.38:52044
  relay  udp 127.0.0.1:49170    related 172.18.0.1:55248
  relay  udp 127.0.0.1:49193    related 172.18.0.1:53242
viewer
  host   udp 172.20.41.38:51080
  srflx  udp 172.18.0.1:59975   related 172.20.41.38:51080
```

`srflx` is genuinely different from the host address (`172.18.0.1` vs
`172.20.41.38`): STUN saw the Docker-gateway source address of the browser’s
UDP socket. `relay` addresses come from successful TURN allocations in
`49160-49200/udp`.

## 5. Browser run — relay-only (`?auto=1&relay=1`)

```text
state=media relay=true media=true

camera candidates: relay=2
viewer candidates: relay=2

selected pair:
  state=succeeded nominated=true
  local  = relay udp 127.0.0.1:49194
  remote = relay udp 127.0.0.1:49181
  rtt    = 0.010 s
  bytes  = 107741 received / 3025 sent

media:
  camera outbound: 100897 bytes, 109 packets, 23 frames encoded
  viewer inbound:  100897 bytes, 109 packets, 0 lost, 23 frames decoded, 640x360
```

Both peers allocated real TURN relays and the selected pair is `relay` ↔ `relay`.
No `relay` string is synthesized anywhere in the client; the candidate comes from
`RTCIceCandidate` events.

## 6. TURN authentication failure (negative test)

A second `camera-service` instance was started with `TURN_PASSWORD=wrong-password`
and the relay-only browser test was run against it. No relay candidate was
fabricated; Chrome reported the real TURN rejection:

```text
state=failed relay=false
camera candidates: {}
camera errors:
  {"code":401,"text":"Unauthorized.","url":"turn:127.0.0.1:3478?transport=udp"}
  {"code":401,"text":"Unauthorized.","url":"turn:127.0.0.1:3478?transport=tcp"}
viewer candidates: {}
viewer errors: same 401 responses
```

This confirms that TURN authentication is actually enforced and that the test
page distinguishes a failed allocation from a missing configuration.

## 7. Signaling relay test

`TestClient` WebSocket exchange (two peers in one room):

```text
cam welcome:   {'type': 'welcome', 'peer': 'cam', 'role': 'camera', ...}
view welcome:  {'type': 'welcome', 'peer': 'view', 'role': 'viewer',
                'peers': [{'peer': 'cam', 'role': 'camera'}, ...]}
cam received:  {'type': 'peer-joined', 'peer': 'view', 'role': 'viewer'}
view received: {'type': 'offer', 'from': 'cam', 'fromRole': 'camera',
                'sdp': {'type': 'offer', 'sdp': 'v=0'}}
```

## 8. Reproduce

```bash
cp .env.example .env
make webrtc-up
make webrtc-stun-check

# terminal 2
python3 -m venv /tmp/mrun-webrtc-venv
/tmp/mrun-webrtc-venv/bin/pip install -r apps/camera-service/requirements.txt
cd apps/camera-service
set -a; source ../../.env; set +a
/tmp/mrun-webrtc-venv/bin/uvicorn src.main:app --host 0.0.0.0 --port 8010

# browser
#   http://127.0.0.1:8010/webrtc/
#   http://127.0.0.1:8010/webrtc/?auto=1&relay=1
```

## 9. Problems encountered

1. **`pydantic-settings` was missing from `requirements.txt`.** `pyproject.toml`
   listed it but the Docker/venv install did not, so `src.webrtc.settings` could
   not import. Added it to `requirements.txt`.
2. **Viewer did not gather `relay` candidates in default mode.** The receiver is
   receive-only and Chrome skips the TURN allocation when a host/srflx path is
   available. Forcing `iceTransportPolicy: relay` makes both peers allocate and
   produces `relay` ↔ `relay`. This is browser behavior, not a coturn failure.
3. **`TURN_EXTERNAL_IP=127.0.0.1` only works for a browser on the same host.**
   For another machine it must be the host LAN/public address, and the UDP relay
   range must be reachable through the firewall.
4. **kind does not publish UDP.** The kind config only maps TCP `80`/`443`, so a
   coturn pod’s `3478/udp` and relay range are not reachable from the host
   without adding UDP `extraPortMappings`. The Compose coturn service is used
   for local browser testing; the Kubernetes manifests are for a real cluster
   with a public IP/firewall.
5. **Headless Chrome hides host IPs with mDNS by default.** The CDP test used
   `--disable-features=WebRtcHideLocalIpsWithMdns` so the host candidate prints
   as `172.20.41.38` instead of a `.local` name.

## 10. Remaining limitations

- The test is same-host loopback (two `RTCPeerConnection`s in one Chromium). It
  exercises real ICE/STUN/TURN/DTLS/SRTP, but it does not traverse a real NAT or
  two independent networks.
- There is no MediaMTX/RTSP/HLS media server in this repository; the media path
  ends at the browser receiver. See `docs/webrtc/README.md` §12 for the future
  integration point.
- The Kubernetes coturn manifests were validated with `kubectl kustomize` but
  not deployed to the kind cluster because kind has no UDP mappings and no mrun
  workloads are currently installed.
- Static TURN credentials are development-only. Use short-lived TURN REST
  credentials and TLS in production.
- The signaling hub is in-memory and per-process. `camera-service` must run one
  replica for the built-in relay (its HPA allows five). A shared pub/sub or
  sticky, room-aware routing is required before horizontal scaling.
