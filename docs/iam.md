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
