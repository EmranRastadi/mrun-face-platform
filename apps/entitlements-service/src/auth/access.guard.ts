import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import type { JwtPayload } from '@mrun/contracts';
import { AuthzClient } from './authz.client';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedPrincipal {
  internal: boolean;
  userId: number;
  username: string;
  platformStaff: boolean;
  activeOrganizationId: string | null;
  token: JwtPayload | null;
}

/**
 * Single entry guard:
 * - `@Public()` routes bypass authentication (health, metrics).
 * - `x-internal-token` (service-to-service, e.g. robots-service or the gateway
 *   fan-out) bypasses RBAC but is still recorded as an internal principal.
 * - Otherwise a Bearer JWT is verified with the platform's shared HS256 secret.
 * - Declared `@RequirePermission(...)` checks are delegated to the PDP.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authz: AuthzClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const internalToken = request.headers['x-internal-token'];
    const expectedInternal = this.config.get<string>('INTERNAL_SERVICE_TOKEN');

    if (
      expectedInternal &&
      typeof internalToken === 'string' &&
      this.safeEqual(internalToken, expectedInternal)
    ) {
      request.principal = {
        internal: true,
        userId: 0,
        username: 'service',
        platformStaff: false,
        activeOrganizationId: null,
        token: null,
      } satisfies AuthenticatedPrincipal;
      return true;
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(
        authorization.slice('Bearer '.length),
        {
          secret: this.config.get<string>('JWT_SECRET'),
          issuer: this.config.get<string>('JWT_ISSUER', 'mrun-users-service'),
          audience: this.config.get<string>('JWT_AUDIENCE', 'mrun-platform'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Token subject is invalid');
    }

    request.user = { ...payload, sub: userId };
    request.principal = {
      internal: false,
      userId,
      username: payload.username,
      platformStaff: payload.platform_staff === true,
      activeOrganizationId: payload.active_org ?? null,
      token: payload,
    } satisfies AuthenticatedPrincipal;

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const headerOrg = request.headers['x-org-id'];
    const organizationId =
      (typeof headerOrg === 'string' ? headerOrg : undefined) ??
      request.params?.organizationId ??
      request.query?.organizationId ??
      request.body?.organizationId ??
      payload.active_org ??
      null;

    for (const permission of required) {
      const decision = await this.authz.check(userId, authorization, {
        permission,
        organizationId: organizationId as string | null,
      });
      if (!decision.allowed) {
        throw new ForbiddenException({
          message: `Missing permission: ${permission}`,
          reason: decision.reason,
        });
      }
    }

    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
