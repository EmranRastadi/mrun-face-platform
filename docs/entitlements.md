# Entitlements (Plans, Subscriptions, Entitlements)

`entitlements-service` is the single owner of commercial plans, feature catalogs,
subscriptions and entitlement resolution. It is exposed only through the gateway
paths `/plans`, `/features`, `/subscriptions`, `/robot-subscriptions`,
`/entitlement-overrides`, `/entitlements`. Port `3000`.

## Domain

- `features` — platform feature keys (`robots.max`, `robots.control`, ...).
- `plans` + `plan_features` — versioned plans with per-feature enabled flag and
  optional `limit_value` (null = unlimited).
- `organization_subscriptions` — plan bound to an organization.
- `robot_subscriptions` — plan bound to a robot inside an organization.
- `entitlement_overrides` — audited allow/deny overrides (robot-specific or org-wide).
- `usage_counters` / `usage_consumptions` — monthly usage, with idempotent consume.
- `entitlement_audit` — audit trail of create/update/cancel/consume actions.

## Resolution precedence

`GET /entitlements/resolve?organizationId=...&featureKey=...&robotId=...`:

1. Active non-revoked, non-expired override (robot-specific preferred over org-wide).
   - `enabled=false` → `OVERRIDE_DENIED`.
2. Robot subscription (must belong to the same organization).
3. Organization subscription (live = `active`/`trialing` and not past `ends_at`).
4. Default plan (`is_default=true`, `status=active`, highest version).
5. Otherwise `NO_PLAN`.

The first source that *defines* the feature wins; a source that is silent falls
through to the next one. An explicit `enabled=false` on a defining source returns
`FEATURE_DISABLED` and stops. Unknown feature key → `FEATURE_NOT_IN_PLAN`.

## Endpoints

Permission source: users-service PDP. `plans:read`/`plans:manage`,
`subscriptions:read`/`subscriptions:manage`, `usage:read`. Tenant roles only get
`subscriptions:read`/`usage:read` by default.

- `GET/POST /features`, `PATCH /features/:key` — `plans:read` / `plans:manage`.
- `GET /plans`, `GET /plans/:id` — `plans:read`.
- `POST /plans`, `PATCH /plans/:id`, `PUT /plans/:id/features` — `plans:manage`.
- `GET/POST /subscriptions`, `GET/PATCH/DELETE /subscriptions/:id` — read/manage.
- `GET/POST /robot-subscriptions`, `GET/DELETE /robot-subscriptions/:id`.
- `GET/POST /entitlement-overrides`, `DELETE /entitlement-overrides/:id`.
- `GET /entitlements/resolve`, `POST /entitlements/check`, `POST /entitlements/consume`, `GET /entitlements/usage`.

`POST /entitlements/check` body `{organizationId, featureKey, robotId?, quantity?}` returns
`EntitlementCheckResult` with `allowed`, `used`, `remaining`, `period_start`.
`POST /entitlements/consume` adds `amount` and optional `idempotencyKey`; a repeated
key returns `duplicate:true` without double counting.

## Service authentication

`AccessGuard` accepts either:
- `x-internal-token` matching `INTERNAL_SERVICE_TOKEN` (internal principal, skips PDP), or
- `Authorization: Bearer <jwt>` verified with the shared `JWT_SECRET`/issuer/audience,
  then enforced via the users-service PDP (`POST /authz/check`), 15 s cache, fail-closed.

## Schema management

Same policy as users-service: `DB_SYNCHRONIZE` defaults to `true` only outside
production; `DB_MIGRATIONS_RUN=true` in production; migration
`1700000001000-EntitlementsSchema` is idempotent. Local runner:
`pnpm --filter entitlements-service migration:run`.

## Tests

`pnpm --filter entitlements-service test` (feature catalog + resolution precedence
+ quota evaluation). Local DB created as `entitlements` role/password `change-me`.
