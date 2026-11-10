# IAM — organizations, RBAC/ABAC and policy decisions

The identity and access-management model lives entirely inside **`users-service`**
(`apps/users-service/src/iam`). It is the only issuer of tokens and the only
Policy Decision Point (PDP); every other service either verifies the JWT or
asks the PDP (`POST /authz/check`).

```
client → api-gateway → users-service
                         ├── JwtAuthGuard        (who are you)
                         ├── PermissionsGuard    (may you do this here)
                         └── AuthzService (PDP)  (RBAC + scope + grants + ABAC)
```

## 1. Domain model

| Entity | Table | Purpose |
|---|---|---|
| `Organization` | `organizations` | tenant / `platform` / `partner`, optional parent |
| `OrgMembership` | `org_memberships` | user ↔ organization, `is_primary` drives the active org |
| `OrgUnit` | `org_units` | department / team / unit / service center, materialized `path` |
| `OrgUnitMember` | `org_unit_members` | user ↔ unit membership |
| `Permission` | `permissions` | canonical `resource:action` catalog |
| `PermissionGroup` / `PermissionGroupItem` | `permission_groups`, `permission_group_items` | reusable bundles |
| `Role` / `RolePermission` / `RolePermissionGroup` | `roles`, … | system role (`organization_id NULL`) or tenant custom role |
| `RoleAssignment` | `role_assignments` | user ↔ role with `scope_type` + `scope_id` + expiry |
| `ResourceGrant` | `resource_grants` | explicit allow/deny for a user, unit or role on one resource |
| `AuthorizationPolicy` | `authorization_policies` | JSON attribute policies |
| `ResourceRegistryEntry` | `resource_registry` | read model of robots/assets owned by other services |
| `PrincipalVersion` | `principal_versions` | token/permission invalidation counters |
| `OutboxEvent` | `outbox_events` | transactional outbox for reliable event publication |

### Tiers and scopes

- **Tier** (`permissions.tier`): `platform` or `tenant`. A tenant-owned role may
  only contain `tenant` permissions; granting a platform permission through
  `POST /roles` returns `400`.
- **Scope** (`role_assignments.scope_type`): `platform` (staff, every org),
  `organization`, `org_unit` (covers descendants via `org_units.path`), `robot`
  (single registry resource).
- A `platform`-scoped assignment satisfies any organization; an `organization`
  -scoped assignment never leaks into another tenant.
- Wildcard `*` exists only in `super_admin` and only for platform staff.

### System roles

Seeded on every boot (`SYSTEM_ROLES`, 20 roles): platform side `super_admin`,
`platform_admin`, `sales_director|manager|agent`,
`support_director|manager|agent`, `tech_lead`, `technician`,
`repair_manager`, `service_center_manager`; tenant side `org_owner`,
`org_admin`, `robot_manager`, `robot_operator`,
`tenant_support_manager|agent`, `employee`, `viewer`.

Tenant roles are restricted to the tenant tier; `org_owner` and `org_admin`
hold the whole tenant catalog. `validateSystemRoleCatalog()` fails the boot if a
role references an unknown permission, and `system-roles.spec.ts` pins the
invariants.

## 2. Decision flow

`AuthzService.check(userId, request)` evaluates, in order:

1. user exists and `is_active` → otherwise `unauthenticated` / `account_inactive`;
2. the organization in scope is `active` → otherwise `organization_inactive`;
3. scope resolution from `resourceType/resourceId` (registry lookup),
   `scopeType/scopeId` (`org_unit` path) or `organizationId`;
4. active, non-expired role assignments that **cover** the scope;
5. explicit **deny** grants → `policy_denied` (deny always wins);
6. attribute policies, deny first, then allow;
7. role permissions (direct + group) or wildcard → `allow`;
8. explicit **allow** grants;
9. otherwise `permission_missing`.

Decisions are cached for 30 s per user/permission/scope tuple, role permissions
for 60 s. `PrincipalVersion.permission_version` is bumped on assignment, grant
and membership changes; `AuthzService.invalidate()` clears the relevant cache
entries immediately.

### ABAC condition DSL

`authorization_policies.condition` is JSON, evaluated without `eval`:

```json
{ "all": [
    { "eq": ["resource.type", "robot"] },
    { "in": ["context.ip", ["10.0.0.0/8"]] }
] }
```

Operators: `all`, `any`, `not`, `eq`, `neq`, `in`, `contains`, `exists`.
Unknown or malformed conditions fail **closed** (`deny`).

## 3. HTTP API (`users-service`, proxied by the gateway)

| Method & path | Permission |
|---|---|
| `GET /organizations` | authenticated; returns orgs the caller belongs to |
| `POST /organizations` | `organizations:manage` |
| `GET /organizations/:id` | `org.profile:read` |
| `PATCH /organizations/:id` | `org.profile:manage` |
| `GET /organizations/:id/members` | `org.members:read` |
| `POST /organizations/:id/members` | `org.members:manage` |
| `PATCH/DELETE /organizations/:id/members/:userId` | `org.members:manage` |
| `GET/POST /organizations/:id/units` | `org.units:read` / `org.units:manage` |
| `PATCH/DELETE /org-units/:unitId?organizationId=` | `org.units:manage` |
| `GET/POST /org-units/:unitId/members` | `org.units:read` / `org.units:manage` |
| `GET /permissions`, `GET /permissions/groups` | authenticated |
| `GET /roles?organizationId=` | `roles:read` |
| `POST /roles`, `PATCH /roles/:id`, `PUT /roles/:id/permissions`, `DELETE /roles/:id` | `roles:manage` |
| `GET /assignments`, `POST /assignments`, `DELETE /assignments/:id` | `roles:read` / `roles:assign` |
| `GET /grants`, `POST /grants`, `DELETE /grants/:id` | `roles:read` / `roles:manage` |
| `POST /authz/check` | authenticated self-check |
| `GET /authz/me/permissions` | authenticated; effective permissions |

Organization context precedence: `x-org-id` header → route/query/body
`organizationId` → token `active_org`.

Anti-escalation rules:

- a caller can only create/assign roles whose permissions they already hold;
- only a super admin may grant `*`;
- platform roles cannot be assigned inside a tenant organization;
- the last `super_admin` assignment and the last owner of a customer
  organization cannot be revoked (nor the last super-admin user deleted);
- system roles are immutable through the API.

## 4. Tokens

`POST /auth/login` returns an HS256 JWT with the legacy claims plus:

| Claim | Meaning |
|---|---|
| `active_org` | organization the session is scoped to (platform org for staff) |
| `platform_staff` | caller holds a `platform`-scoped role |
| `ver` | `principal_versions.permission_version` at issue time |
| `sid` | session id (random UUID) |

`role` (`admin`/`operator`/`viewer`) is still emitted until every service has
migrated to permission checks. Permission changes take effect immediately for
the PDP (cache invalidated) but the token keeps its claims until re-login.

### 4.1 Keycloak token exchange

Keycloak is the **edge identity provider**. It authenticates the user, but the
rest of the platform keeps using the same HS256 token and integer user IDs:

```
browser ──login──▶ Keycloak ──access token (RS256)──▶ browser
browser ──POST /auth/keycloak/exchange──▶ api-gateway ──▶ users-service
                                                           │ verify RS256/JWKS
                                                           │ map username → local user
                                                           │ issue HS256 platform token
browser ◀──────────────────────────────────────────────────┘
```

`users-service` exposes a public `POST /auth/keycloak/exchange`; the gateway
proxies the same path. Request and response:

```json
{ "access_token": "<keycloak access token>" }
```

```json
{
  "access_token": "<platform HS256 token>",
  "token_type": "Bearer",
  "expires_in": "7d",
  "auth_provider": "keycloak",
  "user": { "id": 7, "username": "mrun", "role": "viewer", "...": "..." }
}
```

The endpoint verifies the RS256 signature against the realm JWKS
(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`),
expiry, `iss` and `azp`. It never needs the Keycloak client secret and never
forwards the Keycloak token downstream.

| Variable | Meaning |
|---|---|
| `KEYCLOAK_ENABLED` | Enable the exchange endpoint; default `false` |
| `KEYCLOAK_URL` | Base URL of Keycloak, e.g. `http://keycloak.mrun-security.svc.cluster.local:8080` |
| `KEYCLOAK_REALM` | Realm name, e.g. `mrun` |
| `KEYCLOAK_CLIENT_ID` | Client whose resource roles are read, e.g. `mrun-backend` |
| `KEYCLOAK_ISSUERS` | Comma-separated allowed `iss` values (default: derived from URL + realm) |
| `KEYCLOAK_ALLOWED_CLIENTS` | Comma-separated allowed `azp` values; default `KEYCLOAK_CLIENT_ID` |
| `KEYCLOAK_AUTO_PROVISION` | Create a local user on first successful exchange; default `false` |
| `KEYCLOAK_SYNC_ROLE` | Overwrite the local user's role from Keycloak roles on every exchange; default `false` |
| `KEYCLOAK_JWKS_CACHE_SECONDS` | JWKS cache lifetime; default `600` |
| `KEYCLOAK_JWKS_URL` | Optional explicit JWKS URL, overriding URL + realm |
| `KEYCLOAK_PUBLIC_KEY` | Optional offline fallback: realm public key in PEM or base64 DER |

Role mapping (realm roles and roles from `resource_access[clientId]`):

| Keycloak roles | Platform role |
|---|---|
| `admin`, `super_admin`, `platform_admin` | `admin` |
| `operator`, `robot_operator`, `technician`, `supervisor` | `operator` |
| anything else, including `user` | `viewer` |

With `KEYCLOAK_AUTO_PROVISION=true`, the first exchange creates a local user
using the Keycloak `preferred_username` (the username is the immutable link),
email and name. With auto-provisioning off, an administrator must create the
local user first. The local account's `is_active` flag always wins; disabled
local users are rejected even if Keycloak still considers them active.

The Keycloak issuer is exact. Keycloak derives `iss` from the URL used to
request the token, so the value changes when you access Keycloak through a
different host or port. The in-cluster configmap accepts the canonical
in-cluster issuer plus the usual local port-forward issuers:

```env
KEYCLOAK_ISSUERS=http://keycloak.mrun-security.svc.cluster.local:8080/realms/mrun,http://localhost:8070/realms/mrun,http://127.0.0.1:8070/realms/mrun,http://localhost:8080/realms/mrun,http://127.0.0.1:8080/realms/mrun
```

If your port-forward uses another port, add that exact issuer. A token minted
at `http://localhost:8070/realms/mrun` is rejected with
`Keycloak token issuer is not allowed` until that issuer is in the list.

For local development, `mrun-backend` can have **Direct access grants**
temporarily enabled so you can obtain a token with a password grant:

```bash
KC_TOKEN=$(curl --noproxy '*' -s \
  -d 'grant_type=password' \
  -d 'client_id=mrun-backend' \
  -d 'client_secret=<mrun-backend-secret>' \
  -d 'username=mrun' \
  -d 'password=change-me' \
  http://localhost:8070/realms/mrun/protocol/openid-connect/token \
  | jq -r .access_token)

curl --noproxy '*' -s -X POST http://localhost/auth/keycloak/exchange \
  -H 'content-type: application/json' \
  -d "{\"access_token\":\"$KC_TOKEN\"}" | jq
```

The exchange response contains a **platform JWT**. Use that token for the
other APIs; the Keycloak token itself is only valid at the exchange endpoint:

```bash
curl --noproxy '*' -s http://localhost/auth/me \
  -H "Authorization: Bearer <platform-jwt>" | jq
```

`mrun-backend` is a confidential client. Direct access grants are convenient
for local testing only and should be disabled afterward; browser clients
should use a public client with the authorization-code + PKCE flow and send
the resulting access token to the exchange endpoint. The exchange endpoint
never needs the client secret and never forwards the Keycloak token
downstream.

## 5. Bootstrap

On `onApplicationBootstrap` `IamSeedService`:

1. upserts the 47-entry permission catalog and the platform permission groups;
2. upserts the 20 system roles and their permissions;
3. ensures the `mrun-platform` organization (`PLATFORM_ORG_SLUG`);
4. creates the bootstrap admin from `BOOTSTRAP_ADMIN_USERNAME` /
   `BOOTSTRAP_ADMIN_PASSWORD` when no admin exists;
5. maps every legacy `admin` user to `super_admin` at `platform` scope.

Seeding is idempotent and never deletes tenant data.

## 6. Schema management

`DB_SYNCHRONIZE` defaults to `true` **only outside production**; production
manifests set `DB_SYNCHRONIZE=false`. The IAM schema is owned by
`src/common/database/migrations/1700000000000-IamSchema.ts` (idempotent, so it
is safe on databases previously created by `synchronize`).

- `DB_MIGRATIONS_RUN=true` runs pending migrations at boot (set in the
  users-service ConfigMap).
- `pnpm --filter users-service migration:run` (after `build`) runs them
  standalone for a Job or a manual rollout.
- `DB_LOGGING=true` enables SQL logging, otherwise quiet.

## 7. Testing

```bash
pnpm --filter users-service test    # catalog + ABAC DSL unit tests
pnpm --filter users-service build
```

End-to-end checks used during development (local Postgres, `CONSUL_ENABLED=false`):

1. `admin` login → `GET /authz/me/permissions` returns `["*"]` and
   `platformStaff: true`;
2. create customer organization → create custom role → add member → assign
   role at `organization` scope;
3. tenant token can read its org but `POST /organizations` and `POST /roles`
   return `403`;
4. a tenant role containing `organizations:manage` is rejected with `400`;
5. an `org_unit`-scoped assignment allows the unit and denies organization-wide
   checks.
