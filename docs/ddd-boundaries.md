# DDD Boundaries

## Identity & Access (users-service, identity-service)
- `users-service` owns the User aggregate + Role (`admin` / `operator` / `viewer`), credentials,
  profiles, and HS256 JWT issuance.
- `identity-service` is the Keycloak integration boundary; it does not own the credentials table.
- DB: `users-db` (Postgres cluster). No other service writes here.

## Cards (cards-service)
- Aggregates: Card. Owns card lifecycle.
- DB: `cards-db` (separate Postgres cluster). Emits `card.events`.

## Enrollment (enrollment-service)
- Aggregates: Person. Owns enrollment + face embeddings.
- Stores: Postgres `enrollment-db` (metadata, truth), MinIO `enroll` (images),
  Milvus `face_embeddings` (vectors — sole writer).
- Emits `enrollment.events` (`enrollment.person.enrolled`, `enrollment.rejected`).

## Vision pipeline (camera → worker → similarity)
- camera-service: edge ingest, emits `camera.events` / `vision.events`.
- worker-service: consumes frames, runs detection, emits `embedding.events`.
- similarity-service: Milvus vector search, emits `recognition.events`.
- No shared DB between stages — Kafka only.

## Audit (audit-service)
- Read model. Consumes `audit.events` + `recognition.events` → ClickHouse `mrun.audit_events`.
- No writes to any domain store.

## Notification (notification-service)
- Consumes `notification.events` + `recognition.events`.
- Dragonfly for dedupe + rate limits. Emits `notification.delivered`.
- Channels: sms / push / email (provider adapters).

## Analytics (analytics-service)
- Pure read model over ClickHouse. No Kafka, no writes.

## Gateway
- No domain logic. Routing, JWT verification, RBAC enforcement, and aggregation only.
