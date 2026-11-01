import { Role } from './roles';

/**
 * Shape of the users API. Services still declare their own decorated DTO
 * classes (validation decorators must run through the service's own
 * class-validator instance) and implement these interfaces, so any shape
 * change breaks compilation in both places.
 */
export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  full_name?: string;
}

export interface UpdateRolePayload {
  role: Role;
}
