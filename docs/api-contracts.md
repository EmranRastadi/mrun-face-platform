# API Contracts

Source of truth:
- REST: OpenAPI served by each service (`/api-docs` via Nest Swagger / FastAPI docs).
- gRPC: `packages/proto/*.proto` (`buf lint` must pass; breaking changes rejected).
- Async: `docs/kafka-topics.md` + `packages/events`.

## gRPC services

| Proto | Service | Methods |
|---|---|---|
| `cards.proto` | `CardsService` | GetCard, CreateCard |
| `camera.proto` | `CameraService` | GetFrame |
| `similarity.proto` | `SimilarityService` | Search |

Regenerate stubs: `make proto` (requires `buf`).

## REST endpoints (new services)

### enrollment-service (8001)
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health |
| POST | `/enroll` | Enroll person (embedding) |
| POST | `/enroll/{person_id}/image` | Upload image to MinIO |
| GET | `/persons` | List persons |
| GET | `/persons/{person_id}` | Get person |
| DELETE | `/persons/{person_id}` | Delete person + vector |

### audit-service (3003)
`GET /health`, `GET /audit`, `GET /api`

### notification-service (3004)
`GET /health`, `GET /notifications`, `GET /api`

### analytics-service (3005)
`GET /analytics/health`, `GET /analytics/recognitions`, `GET /analytics/cameras`,
`GET /analytics/latency`, `GET /analytics/activity`, `GET /api`

Gateway proxies: `/enrollment/*`, `/audit/*`, `/notifications/*`, `/analytics/*`.
