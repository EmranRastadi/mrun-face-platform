import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import type { AuthzDecisionResult, ScopeType } from '@mrun/contracts';

export interface AuthzQuery {
  permission: string;
  organizationId?: string | null;
  scopeType?: ScopeType | null;
  scopeId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
}

interface CachedDecision {
  expiresAt: number;
  result: AuthzDecisionResult;
}

const CACHE_TTL_MS = 15_000;

/**
 * Thin client for the authorization PDP that lives in `users-service`.
 *
 * Entitlements are commercial data, but access to them is still governed by the
 * central permission model, so this service never re-implements RBAC. Calls are
 * made with the caller's own bearer token to preserve the identity chain.
 *
 * Failure is closed: if the PDP is unreachable the request is denied.
 */
@Injectable()
export class AuthzClient {
  private readonly logger = new Logger(AuthzClient.name);
  private readonly http: AxiosInstance;
  private readonly cache = new Map<string, CachedDecision>();

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.get<string>(
        'USERS_SERVICE_URL',
        'http://users-service:3000',
      ),
      timeout: 3000,
      validateStatus: () => true,
    });
  }

  async check(
    userId: number,
    authorization: string,
    query: AuthzQuery,
  ): Promise<AuthzDecisionResult> {
    const cacheKey = [
      userId,
      query.permission,
      query.organizationId ?? '',
      query.scopeType ?? '',
      query.scopeId ?? '',
      query.resourceType ?? '',
      query.resourceId ?? '',
    ].join('|');

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    try {
      const { status, data } = await this.http.post<AuthzDecisionResult>(
        '/authz/check',
        {
          permission: query.permission,
          organizationId: query.organizationId ?? undefined,
          scopeType: query.scopeType ?? undefined,
          scopeId: query.scopeId ?? undefined,
          resourceType: query.resourceType ?? undefined,
          resourceId: query.resourceId ?? undefined,
        },
        { headers: { authorization } },
      );

      if (status >= 400 || typeof data?.allowed !== 'boolean') {
        return this.deny(query.permission, 'pdp_error');
      }

      this.cache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result: data,
      });
      return data;
    } catch (error) {
      this.logger.error(
        `PDP call failed for permission "${query.permission}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.deny(query.permission, 'pdp_unavailable');
    }
  }

  invalidate(): void {
    this.cache.clear();
  }

  private deny(permission: string, reason: string): AuthzDecisionResult {
    return {
      allowed: false,
      decision: 'deny' as never,
      reason: reason as never,
      checkedAt: new Date().toISOString(),
      matchedRoleIds: [],
    };
  }
}
