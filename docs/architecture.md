# Architecture — mrun-face-platform

Monorepo: `apps/*` (deployables) + `packages/*` (shared) + `infrastructure/*` (K8s).

## Services

| Service | Lang | Port | DB / Store | Talks via |
|---|---|---|---|---|
| api-gateway | NestJS | 3000 | stateless | REST in, HTTP out |
| users-service | NestJS | 3001 | Postgres `users` | REST + JWT issuance + IAM/RBAC/ABAC (PDP) + Kafka `user.events` |
| identity-service | NestJS | 3002 | Keycloak / Postgres | REST + Keycloak integration |
| cards-service | FastAPI | 8000 | Postgres `cards-db` | REST + `card.events` |
| camera-service | FastAPI | 8000 | — (edge ingest) | gRPC `camera.proto` + `camera.events` + WebRTC ICE/signaling |
| similarity-service | FastAPI | 8000 | Milvus | gRPC `similarity.proto` + `embedding.events` |
| worker-service | Python | — | Kafka consumer | consumes `vision/recognition/*` |
| enrollment-service | FastAPI | 8001 | Postgres `enrollment-db` + MinIO + Milvus | REST + `enrollment.events` |
| audit-service | NestJS | 3003 | ClickHouse | consumes `audit/recognition.events` |
| notification-service | NestJS | 3004 | Dragonfly | consumes `notification/recognition.events`, emits `notification.delivered` |
| analytics-service | NestJS | 3005 | ClickHouse (read) | REST only |

## Data stores

| Store | Used for | Namespace |
|---|---|---|
| PostgreSQL (CloudNativePG) | per-service system of record | `mrun-database` |
| Dragonfly | hot state, rate limits, dedupe, sessions | `mrun-system` |
| Milvus | face embedding vectors | `mrun-system` |
| MinIO | blobs (frames, faces, enroll, models) | `mrun-system` |
| ClickHouse | append-only analytics sink | `mrun-system` |
| Kafka | async events | `mrun-messaging` |
| Consul | service discovery | `mrun-system` |

## Shared packages

- `@mrun/contracts` — dependency-free shapes shared by the NestJS services: `Role`, extended JWT claims, user payload interfaces, pagination types, plus organization, RBAC (roles/permissions/assignments/grants) and authz decision contracts.
- `@mrun/events` — Kafka topic constants + `BaseEvent` envelope.
- `@mrun/proto` — `cards|camera|similarity.proto`, generated via `buf`.

## Rules

1. `apps/*` must NOT import from each other — only from `packages/*`.
2. All cross-service async goes through Kafka topics in `packages/events`.
3. All sync ML/data-plane contracts go through `packages/proto`.
4. One writer per store; Postgres is truth, others derived.
5. Auth: `users-service` issues HS256 JWTs; `api-gateway` and `cards-service` verify them.
   `users-service` is the only Policy Decision Point: organizations, scoped RBAC, explicit
   resource grants and JSON ABAC policies (see [`docs/iam.md`](iam.md)). Inside the IAM code,
   legacy `admin` / `operator` / `viewer` roles are kept only for backward compatibility.
6. Schema: `synchronize` is development-only (`DB_SYNCHRONIZE`); production runs TypeORM
   migrations (`DB_MIGRATIONS_RUN`), one migration owner per database.
7. Env: `.env.example` committed, `.env` never committed.
8. HTTP methods: services answer `GET`, `POST`, `PUT`, `PATCH`, `DELETE` only.
   `HEAD` and `OPTIONS` are rejected with `405 Method Not Allowed`; CORS
   preflight is intentionally unsupported.

- `entitlements-service` (NestJS 3000): plans, subscriptions, entitlement resolution (PDP via users-service). See `docs/entitlements.md`.

## WebRTC / ICE

`camera-service` is also the WebRTC edge: it exposes `GET /webrtc/config` (browser
`iceServers`), `GET /webrtc/diagnostics` (real STUN Binding probe + TURN TCP
check), a WebSocket signaling relay at `/webrtc/signaling`, and a static
connectivity test page at `/webrtc/`. coturn supplies STUN/TURN in Compose
(profile `webrtc`) and in Kubernetes (`infrastructure/platform/webrtc/coturn/`).
The application layer still has no media server; the test page uses two real
browser `RTCPeerConnection`s. See `docs/webrtc/README.md` for architecture,
NAT scenarios, ports and production guidance.
