/**
 * Shared roles. Kept dependency-free (no decorators) so this package can be
 * imported by every service without pulling a second copy of class-validator.
 */
export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}
