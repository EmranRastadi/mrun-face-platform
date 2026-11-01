import { PermissionTier } from '@mrun/contracts';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  TENANT_PERMISSION_KEYS,
} from './permissions.catalog';
import {
  SYSTEM_ROLES,
  SystemRoleKey,
  validateSystemRoleCatalog,
} from './system-roles';

describe('IAM catalog', () => {
  it('has unique permission keys', () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('validates every system role permission', () => {
    expect(() => validateSystemRoleCatalog()).not.toThrow();
  });

  it('keeps tenant roles to tenant-tier permissions', () => {
    const tenantKeys = new Set(TENANT_PERMISSION_KEYS);
    for (const role of SYSTEM_ROLES) {
      if (role.tier === PermissionTier.TENANT) {
        for (const permission of role.permissions) {
          expect(tenantKeys.has(permission)).toBe(true);
        }
      }
    }
  });

  it('gives only super_admin the wildcard', () => {
    const wildcardRoles = SYSTEM_ROLES.filter((r) =>
      r.permissions.includes('*'),
    ).map((r) => r.key);
    expect(wildcardRoles).toEqual([SystemRoleKey.SUPER_ADMIN]);
  });

  it('defines every permission group member', () => {
    const known = new Set(PERMISSION_CATALOG.map((p) => p.key));
    for (const group of PERMISSION_GROUPS) {
      for (const key of group.permissions) {
        expect(known.has(key)).toBe(true);
      }
    }
  });
});
