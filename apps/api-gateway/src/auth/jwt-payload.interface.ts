import { Role } from './roles.enum';

/**
 * Token claims. `sub` is a string per RFC 7519; the internal
 * authenticated user keeps it as a number for convenience.
 */
export interface JwtClaims {
  sub: string;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}
