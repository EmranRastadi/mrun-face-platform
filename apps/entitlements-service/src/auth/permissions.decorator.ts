import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Declares the permissions a route requires. The caller must hold every one of
 * them inside the resolved organization scope. Decisions are delegated to the
 * PDP in `users-service` so permission logic has exactly one owner.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
