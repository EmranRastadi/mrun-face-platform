# analytics-service

Read-only API over **ClickHouse** `mrun.audit_events` (populated by audit-service). No Kafka, no writes.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/health` | ClickHouse status |
| GET | `/analytics/recognitions?from=&to=` | Daily recognition totals (matched/missed) |
| GET | `/analytics/cameras` | Per-camera recognition counts |
| GET | `/analytics/latency` | Hourly event volume |
| GET | `/analytics/activity?limit=` | Recent activity feed |
| GET | `/api` | Swagger |

## Env (`.env.example`)

`CLICKHOUSE_HOST/PORT/USER/PASSWORD/DATABASE`, `CLICKHOUSE_ENABLED`.

## Run

```bash
cp .env.example .env
pnpm install
pnpm --filter analytics-service start:dev
```
