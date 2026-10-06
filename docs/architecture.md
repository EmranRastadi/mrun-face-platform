# Architecture — mrun-face-platform

Monorepo: `apps/*` (deployables) + `packages/*` (shared) + `infrastructure/*` (K8s).

## Services

| Service | Lang | Port | DB / Store | Talks via |
|---|---|---|---|---|
| api-gateway | NestJS | 3000 | stateless | REST in, HTTP out |
| users-service | NestJS | 3001 | Postgres `users-db` | REST + Kafka `user.events` |
| identity-service | NestJS | 3002 | Keycloak / Postgres | REST + JWT |
| cards-service | FastAPI | 8000 | Postgres `cards-db` | REST + `card.events` |
| camera-service | FastAPI | 8000 | — (edge ingest) | gRPC `camera.proto` + `camera.events` |
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

- `@mrun/common` — Result, pagination, health, logging helpers.
- `@mrun/ddd` — Entity, ValueObject, AggregateRoot, Repository.
- `@mrun/events` — Kafka topic constants + `BaseEvent` envelope.
- `@mrun/proto` — `cards|camera|similarity.proto`, generated via `buf`.

## Rules

1. `apps/*` must NOT import from each other — only from `packages/*`.
2. All cross-service async goes through Kafka topics in `packages/events`.
3. All sync ML/data-plane contracts go through `packages/proto`.
4. One writer per store; Postgres is truth, others derived.
5. Env: `.env.example` committed, `.env` never committed.
