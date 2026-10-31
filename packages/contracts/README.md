# @mrun/contracts

Dependency-free data shapes shared by the NestJS services.

| File | Contents |
|---|---|
| `roles.ts` | `Role` enum — the single definition used by gateway and users-service |
| `jwt.ts` | `JwtClaims`, `JwtPayload` |
| `auth.ts` | `LoginPayload` |
| `users.ts` | `CreateUserPayload`, `UpdateUserPayload`, `UpdateRolePayload` |
| `pagination.ts` | `PageQuery`, `Paginated<T>` |

## Rules

- **Types and enums only.** No decorators, no runtime helpers, no service code.
  A decorated DTO (`@IsString()` etc.) must stay inside its service: the
  decorators bind to that service's `class-validator` instance. Services
  declare their DTO class with `implements CreateUserPayload` instead.
- **No FastAPI models.** Python services own their Pydantic models; share
  shapes across languages through OpenAPI/JSON Schema, not this package.
- Anything only one service uses does not belong here.

Consumers: `apps/api-gateway`, `apps/users-service`.

```bash
pnpm --filter @mrun/contracts build
```
