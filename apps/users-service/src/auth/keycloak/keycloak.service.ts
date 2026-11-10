import { createPublicKey } from 'crypto';
import type { JsonWebKey } from 'crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@mrun/contracts';

const DEFAULT_CLIENT_ID = 'mrun-backend';
const JWKS_FETCH_TIMEOUT_MS = 5000;

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'platform_admin']);
const OPERATOR_ROLES = new Set([
  'operator',
  'robot_operator',
  'technician',
  'supervisor',
]);

interface KeycloakTokenClaims {
  sub?: unknown;
  preferred_username?: unknown;
  username?: unknown;
  email?: unknown;
  name?: unknown;
  iss?: unknown;
  azp?: unknown;
  aud?: unknown;
  realm_access?: { roles?: unknown };
  resource_access?: Record<string, { roles?: unknown } | undefined>;
  [key: string]: unknown;
}

interface DecodedKeycloakToken {
  header?: { alg?: string; kid?: string; [key: string]: unknown };
  payload?: KeycloakTokenClaims;
}

interface JwksCache {
  keys: Map<string, string>;
  expiresAt: number;
}

export interface KeycloakIdentity {
  subject: string;
  username: string;
  email?: string;
  fullName?: string;
  role: Role;
  roleNames: string[];
  issuer: string;
  clientId?: string;
}

/**
 * Verifies Keycloak access tokens and maps their roles to the platform role
 * model. Platform tokens remain HS256 tokens issued by users-service; Keycloak
 * is only the identity provider at the edge.
 */
@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);

  /**
   * A private JwtService instance is used on purpose. The application-wide
   * JwtService is configured with the HS256 platform secret, and
   * @nestjs/jwt prefers that secret over a per-call publicKey. Using a bare
   * instance guarantees RS256 tokens are verified with the Keycloak key only.
   */
  private readonly jwt = new JwtService({});

  private readonly jwksTimeoutMs = JWKS_FETCH_TIMEOUT_MS;

  private jwksCache?: JwksCache;
  private staticPublicKeyCache?: string;

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.boolean('KEYCLOAK_ENABLED', false);
  }

  get autoProvision(): boolean {
    return this.boolean('KEYCLOAK_AUTO_PROVISION', false);
  }

  get syncRole(): boolean {
    return this.boolean('KEYCLOAK_SYNC_ROLE', false);
  }

  async verifyToken(token: string): Promise<KeycloakIdentity> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Keycloak authentication is disabled',
      );
    }

    const decoded = this.jwt.decode<DecodedKeycloakToken>(token, {
      complete: true,
    });
    if (!decoded?.header || !decoded.payload) {
      throw new UnauthorizedException('Invalid Keycloak token');
    }
    if (decoded.header.alg !== 'RS256') {
      throw new UnauthorizedException(
        'Keycloak token must be signed with RS256',
      );
    }

    const candidates = await this.publicKeyCandidates(decoded.header.kid);
    let claims: KeycloakTokenClaims | undefined;
    let lastError: unknown;

    for (const publicKey of candidates) {
      try {
        claims = await this.jwt.verifyAsync<KeycloakTokenClaims>(token, {
          publicKey,
          algorithms: ['RS256'],
          clockTolerance: 30,
        });
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!claims) {
      this.logger.warn(
        `Keycloak token verification failed: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
      throw new UnauthorizedException('Invalid or expired Keycloak token');
    }

    this.assertIssuer(claims.iss);
    this.assertClient(claims.azp);

    const username =
      this.stringClaim(claims.preferred_username) ??
      this.stringClaim(claims.username) ??
      this.stringClaim(claims.email);
    if (!username) {
      throw new UnauthorizedException(
        'Keycloak token does not contain a username',
      );
    }

    const subject = this.stringClaim(claims.sub);
    if (!subject) {
      throw new UnauthorizedException(
        'Keycloak token does not contain a subject',
      );
    }

    const roleNames = this.extractRoles(claims);

    return {
      subject,
      username,
      email: this.stringClaim(claims.email),
      fullName: this.stringClaim(claims.name),
      role: this.mapRole(roleNames),
      roleNames,
      issuer: this.stringClaim(claims.iss)!,
      clientId: this.stringClaim(claims.azp),
    };
  }

  private async publicKeyCandidates(kid?: string): Promise<string[]> {
    const now = Date.now();

    if (this.jwksCache && this.jwksCache.expiresAt > now) {
      const cached = this.selectKeys(this.jwksCache.keys, kid);
      if (cached.length) return cached;
    }

    try {
      const keys = await this.fetchJwks();
      this.jwksCache = {
        keys,
        expiresAt: now + this.jwksCacheSeconds * 1000,
      };
      const selected = this.selectKeys(keys, kid);
      if (selected.length) return selected;
      if (kid) {
        this.logger.warn(`Keycloak JWKS does not contain kid "${kid}"`);
      }
    } catch (error) {
      this.logger.warn(
        `Unable to load Keycloak JWKS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const staticKey = this.staticPublicKey();
    if (staticKey) return [staticKey];

    if (kid) {
      throw new UnauthorizedException('Unknown Keycloak signing key');
    }
    throw new ServiceUnavailableException('Keycloak signing keys are unavailable');
  }

  private selectKeys(keys: Map<string, string>, kid?: string): string[] {
    if (kid) {
      const key = keys.get(kid);
      return key ? [key] : [];
    }
    return [...keys.values()];
  }

  private async fetchJwks(): Promise<Map<string, string>> {
    const url = this.jwksUrl;
    if (!url) {
      throw new Error(
        'KEYCLOAK_URL/KEYCLOAK_REALM or KEYCLOAK_JWKS_URL is not configured',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.jwksTimeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`JWKS request failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) {
      throw new Error('JWKS response does not contain a keys array');
    }

    const keys = new Map<string, string>();
    for (const value of body.keys) {
      if (!value || typeof value !== 'object') continue;
      const jwk = value as JsonWebKey & {
        kid?: string;
        alg?: string;
        use?: string;
        kty?: string;
      };

      if (jwk.kty !== 'RSA') continue;
      if (jwk.alg && jwk.alg !== 'RS256') continue;
      if (jwk.use && jwk.use !== 'sig') continue;
      if (!jwk.kid) continue;

      try {
        const key = createPublicKey({ key: jwk, format: 'jwk' });
        keys.set(
          jwk.kid,
          key.export({ type: 'spki', format: 'pem' }).toString(),
        );
      } catch (error) {
        this.logger.warn(
          `Skipping invalid Keycloak JWK "${jwk.kid}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (!keys.size) {
      throw new Error('JWKS response does not contain a usable RS256 key');
    }
    return keys;
  }

  private staticPublicKey(): string | undefined {
    if (this.staticPublicKeyCache !== undefined) {
      return this.staticPublicKeyCache || undefined;
    }

    const configured = this.config.get<string>('KEYCLOAK_PUBLIC_KEY');
    if (!configured) {
      this.staticPublicKeyCache = '';
      return undefined;
    }

    const key = this.normalizePublicKey(configured);
    if (!key) {
      this.staticPublicKeyCache = '';
      return undefined;
    }

    try {
      createPublicKey(key);
      this.staticPublicKeyCache = key;
      return key;
    } catch (error) {
      this.logger.error(
        `KEYCLOAK_PUBLIC_KEY is not a valid public key: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.staticPublicKeyCache = '';
      return undefined;
    }
  }

  private normalizePublicKey(configured: string): string | undefined {
    const value = configured.trim().replace(/\\n/g, '\n');
    if (!value) return undefined;

    if (value.startsWith('{')) {
      try {
        const jwk = JSON.parse(value) as JsonWebKey;
        return createPublicKey({ key: jwk, format: 'jwk' })
          .export({ type: 'spki', format: 'pem' })
          .toString();
      } catch {
        return undefined;
      }
    }

    if (value.includes('BEGIN')) return value;

    const body = value.replace(/\s+/g, '');
    if (!body) return undefined;
    return `-----BEGIN PUBLIC KEY-----\n${body
      .replace(/(.{64})/g, '$1\n')
      .trim()}\n-----END PUBLIC KEY-----`;
  }

  private assertIssuer(issuer: unknown): void {
    const allowed = this.allowedIssuers;
    if (!allowed.length) {
      throw new ServiceUnavailableException(
        'KEYCLOAK_ISSUERS is not configured',
      );
    }
    const actual = this.stringClaim(issuer);
    if (!actual || !allowed.includes(this.trimTrailingSlash(actual))) {
      throw new UnauthorizedException('Keycloak token issuer is not allowed');
    }
  }

  private assertClient(clientId: unknown): void {
    const allowed = this.allowedClients;
    if (!allowed.length) {
      throw new ServiceUnavailableException(
        'KEYCLOAK_ALLOWED_CLIENTS is not configured',
      );
    }
    const actual = this.stringClaim(clientId);
    if (!actual || !allowed.includes(actual)) {
      throw new UnauthorizedException('Keycloak token client is not allowed');
    }
  }

  private extractRoles(claims: KeycloakTokenClaims): string[] {
    const roles = new Set<string>();
    const add = (value: unknown) => {
      if (!Array.isArray(value)) return;
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) roles.add(item.trim());
      }
    };

    add(claims.realm_access?.roles);

    const configuredClient = this.config.get<string>('KEYCLOAK_CLIENT_ID');
    if (configuredClient) {
      add(claims.resource_access?.[configuredClient]?.roles);
    }
    const tokenClient = this.stringClaim(claims.azp);
    if (tokenClient) {
      add(claims.resource_access?.[tokenClient]?.roles);
    }

    return [...roles];
  }

  private mapRole(roles: string[]): Role {
    const normalized = roles.map((role) =>
      role.toLowerCase().replace(/[\s-]+/g, '_'),
    );
    if (normalized.some((role) => ADMIN_ROLES.has(role))) {
      return Role.ADMIN;
    }
    if (normalized.some((role) => OPERATOR_ROLES.has(role))) {
      return Role.OPERATOR;
    }
    return Role.VIEWER;
  }

  private get jwksCacheSeconds(): number {
    const raw = this.config.get<string>('KEYCLOAK_JWKS_CACHE_SECONDS');
    const value = raw === undefined ? 600 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 600;
  }

  private get jwksUrl(): string | undefined {
    const explicit = this.config.get<string>('KEYCLOAK_JWKS_URL');
    if (explicit?.trim()) return explicit.trim();

    const base = this.keycloakUrl;
    const realm = this.realm;
    if (!base || !realm) return undefined;
    return `${base}/realms/${realm}/protocol/openid-connect/certs`;
  }

  private get keycloakUrl(): string {
    return this.trimTrailingSlash(
      this.config.get<string>('KEYCLOAK_URL')?.trim() ?? '',
    );
  }

  private get realm(): string {
    return this.config.get<string>('KEYCLOAK_REALM')?.trim() ?? '';
  }

  private get allowedIssuers(): string[] {
    const configured = this.config.get<string>('KEYCLOAK_ISSUERS');
    if (configured !== undefined) {
      return this.csv(configured).map((issuer) =>
        this.trimTrailingSlash(issuer),
      );
    }

    const base = this.keycloakUrl;
    const realm = this.realm;
    if (!base || !realm) return [];
    return [`${base}/realms/${realm}`];
  }

  private get allowedClients(): string[] {
    const configured = this.config.get<string>('KEYCLOAK_ALLOWED_CLIENTS');
    if (configured !== undefined) {
      return this.csv(configured);
    }

    const clientId = this.config.get<string>('KEYCLOAK_CLIENT_ID')?.trim();
    return [clientId || DEFAULT_CLIENT_ID];
  }

  private csv(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }

  private stringClaim(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private boolean(key: string, fallback: boolean): boolean {
    const raw = this.config.get<string | boolean>(key);
    if (typeof raw === 'boolean') return raw;
    if (raw === undefined || raw === null || raw === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
  }
}
