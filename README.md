# mrun-face-platform

Monorepo for the MRUN face-recognition platform: NestJS + FastAPI microservices with a shared contracts
layer and Kustomize/Skaffold deployment.

## Services

| Service | Stack | Port | Responsibility |
| --- | --- | --- | --- |
| `api-gateway` | NestJS | 3000 | Edge routing / reverse proxy to all services |
| `users-service` | NestJS | 3001 | Users, auth |
| `identity-service` | NestJS | 3002 | Identity / access |
| `cards-service` | FastAPI | 8000 | Cards |
| `enrollment-service` | FastAPI | 8001 | Person enrollment (Postgres + MinIO + Milvus + Kafka) |
| `audit-service` | NestJS | 3003 | Kafka consumer → ClickHouse audit log |
| `notification-service` | NestJS | 3004 | Event-driven notifications (Dragonfly rate-limit/dedupe) |
| `analytics-service` | NestJS | 3005 | Read-only analytics API over ClickHouse |
| `camera-service` | FastAPI | — | Camera ingestion (scaffold) |
| `similarity-service` | FastAPI | — | Vector similarity (scaffold) |
| `worker-service` | FastAPI | — | Recognition worker (scaffold) |

## Data stores

| Store | Use |
| --- | --- |
| PostgreSQL | System of record (per-service databases) |
| Dragonfly | Hot state: sessions, rate limits, idempotency, caches |
| Milvus | Face embeddings (vectors only; metadata in Postgres) |
| MinIO | BLOB storage (frames, faces, enrollments, models) |
| ClickHouse | Append-only analytics sink of domain events |
| Kafka | Event bus (KRaft, no ZooKeeper) |
| Consul | Service discovery |

## Layout

- `apps/*` — deployable services, each with `Dockerfile`, `.env.example`, and `pyproject.toml` or `package.json`.
- `packages/common|DDD|events|proto` — shared code; services import only from here, never from each other.
- `infrastructure/` — Kustomize stacks: `bootstrap/` → `platform/` → `apps/`. Root: `infrastructure/kustomization.yaml`.
- `docs/` — architecture, DDD boundaries, API contracts, Kafka topics.

## Quickstart (Docker Compose)

```bash
cp .env.example .env
pnpm install
docker compose up -d
```

Endpoints: gateway `:3000`, users `:3001`, cards `:8000`, enrollment `:8001`, audit `:3003`,
notification `:3004`, analytics `:3005`, Kafka UI `:8080`, MinIO console `:9001`, ClickHouse `:8123`,
Consul UI `:8500`.

Stop / reset:

```bash
docker compose down        # keep volumes
docker compose down -v     # wipe volumes
```

Only want the infra for local development (no app containers)? Start the specific stores you need, e.g.
`docker compose up -d postgres kafka consul dragonfly minio etcd milvus clickhouse`.

## Local development (no app containers)

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres kafka consul dragonfly minio etcd milvus clickhouse
pnpm build                 # builds @mrun/events + common + DDD + Nest services
pnpm dev                   # turbo run start:dev --parallel (Nest services, watch mode)
```

`pnpm dev` only runs services with a `start:dev` script (the NestJS ones). Run the FastAPI services
manually:

```bash
cd apps/enrollment-service && uvicorn src.main:app --reload --port 8001
cd apps/cards-service      && uvicorn app.main:app  --reload --port 8000
```

Single service:

```bash
pnpm --filter audit-service start:dev
pnpm --filter audit-service build && pnpm --filter audit-service start:prod
```

## Run without any infrastructure

The newer services are built to degrade gracefully, so you can start them with nothing else running:

```bash
# audit / notification / analytics boot fine with their stores disabled
KAFKA_ENABLED=false CLICKHOUSE_ENABLED=false DRAGONFLY_ENABLED=false \
  pnpm --filter audit-service start:prod

# the gateway runs without Consul
CONSUL_ENABLED=false pnpm --filter api-gateway start:prod

# enrollment falls back to an in-memory repository when Postgres is down
cd apps/enrollment-service && uvicorn src.main:app --port 8001
```

`users-service` and `cards-service` require PostgreSQL; start Postgres (compose or native) before them.

## Kubernetes / Skaffold

```bash
kubectl kustomize infrastructure     # render the full tree
skaffold run -p prod                 # or: make deploy
```

Layers: `infrastructure/bootstrap/namespace` → `infrastructure/platform` (databases, discovery, messaging) → `infrastructure/apps`.

## Contracts

- Sync: `packages/proto/*.proto` → `make proto` (buf).
- Async: `packages/events/topics/kafka-topics.ts` → `docs/kafka-topics.md`.

## Quality gates

```bash
pnpm build && pnpm lint && pnpm test
```

## Commands (`Makefile`)

`make install|dev|build|test|lint|format|proto|clean|up|down|deploy`

## Troubleshooting

- **`manifest for bitnami/kafka:3.7 not found`** — Bitnami removed its free Docker Hub catalog. This
  repo uses the official `apache/kafka:3.9.0` image; pull the latest `docker-compose.yml`.
- **BLOB/vector errors on enrollment** — ensure `minio`, `etcd`, and `milvus` are up before
  `enrollment-service`.
- **Kafka clients can't connect** — the broker advertises `kafka:9092`; run clients on the
  `mrun-network` (i.e. as compose services), or use `localhost:9092` from the host.
