# audit-service

Kafka consumer that persists **audit.events** and **recognition.events** into **ClickHouse** (`mrun.audit_events`), with an in-memory recent buffer for quick inspection.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health + ClickHouse status |
| GET | `/audit` | Last 100 persisted events (in-memory) |
| GET | `/api` | Swagger |

## Env (`.env.example`)

`KAFKA_BROKERS`, `KAFKA_GROUP_ID=audit-workers`, `CLICKHOUSE_HOST/PORT/USER/PASSWORD/DATABASE`, plus `*_ENABLED` flags (default false → boots without infra).

## Run

```bash
cp .env.example .env
pnpm install
pnpm --filter audit-service start:dev
```
