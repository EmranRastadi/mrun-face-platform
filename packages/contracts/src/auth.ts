/**
 * Request/response shapes for the auth API.
 *
 * Services keep their own decorated DTO classes (validation must run through
 * the service's own class-validator instance) and implement these interfaces.
 */
export interface LoginPayload {
  username: string;
  password: string;
}
