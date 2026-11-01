import { Role } from './roles';

/**
 * Token claims. `sub` is a string per RFC 7519; the internal
 * authenticated user keeps it as a number for convenience.
 *
 * `role` is the legacy single-role claim kept until every service has moved to
 * permission checks. `active_org`, `platform_staff`, `ver` and `sid` are the
 * additive enterprise claims.
 */
export interface JwtClaims {
  sub: string;
  username: string;
  role: Role;
  active_org?: string | null;
  platform_staff?: boolean;
  ver?: number;
  sid?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  active_org?: string | null;
  platform_staff?: boolean;
  ver?: number;
  sid?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}
