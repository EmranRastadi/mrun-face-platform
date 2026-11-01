import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtPayload, ScopeType } from '@mrun/contracts';
import { AuthzService } from '../authz.service';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

/**
 * Permission enforcement point. Requires `JwtAuthGuard` to run first so that
 * `request.user` is populated.
 *
 * Organization context precedence: `x-org-id` header, then route/query/body
 * `organizationId`, then the token's active organization.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const headerOrg = request.headers['x-org-id'];
    const organizationId =
      (typeof headerOrg === 'string' ? headerOrg : undefined) ??
      request.params?.organizationId ??
      request.query?.organizationId ??
      request.body?.organizationId ??
      user.active_org ??
      null;

    const scopeType = (request.params?.scopeType ??
      request.query?.scopeType ??
      request.body?.scopeType ??
      null) as ScopeType | null;
    const scopeId =
      request.params?.scopeId ??
      request.query?.scopeId ??
      request.body?.scopeId ??
      null;

    const resourceType =
      request.query?.resourceType ?? request.body?.resourceType ?? null;
    const resourceId =
      request.params?.resourceId ??
      request.query?.resourceId ??
      request.body?.resourceId ??
      null;

    for (const permission of required) {
      const result = await this.authz.check(user.sub, {
        permission,
        organizationId: organizationId ?? null,
        scopeType,
        scopeId,
        resourceType,
        resourceId,
      });
      if (!result.allowed) {
        throw new ForbiddenException({
          message: `Missing permission: ${permission}`,
          reason: result.reason,
        });
      }
    }
    return true;
  }
}
