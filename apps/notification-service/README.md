# notification-service

Consumes **notification.events** + **recognition.events**, applies dedupe + rate limits via **Dragonfly** (Redis-compatible), dispatches over `sms | push | email`, and emits `notification.delivered`.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health + Dragonfly status |
| GET | `/notifications` | Last 100 deliveries (in-memory) |
| GET | `/api` | Swagger |

## Env (`.env.example`)

`KAFKA_*`, `DRAGONFLY_HOST/PORT`, `NOTIFY_RATE_LIMIT_PER_MINUTE`, `NOTIFY_DEDUPE_TTL_SECONDS`, plus `*_ENABLED` flags.

## Run

```bash
cp .env.example .env
pnpm install
pnpm --filter notification-service start:dev
```
