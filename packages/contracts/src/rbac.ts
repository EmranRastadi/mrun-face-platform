/**
 * Role-based access control contracts.
 *
 * Permissions use the `resource:action` convention. A permission's `tier`
 * decides whether a tenant-owned role may include it: `tenant` permissions can
 * be granted inside an organization, `platform` permissions only by platform
 * staff.
 */
export enum PermissionTier {
  PLATFORM = 'platform',
  TENANT = 'tenant',
}

export enum RoleKind {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export enum ScopeType {
  PLATFORM = 'platform',
  ORGANIZATION = 'organization',
  ORG_UNIT = 'org_unit',
  ROBOT = 'robot',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum GrantEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

export enum GrantSubjectType {
  USER = 'user',
  ORG_UNIT = 'org_unit',
  ROLE = 'role',
}

export interface PermissionDefinition {
  key: string;
  resource: string;
  action: string;
  description: string;
  tier: PermissionTier;
  is_system: boolean;
}

export interface PermissionGroupDefinition {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  organization_id: string | null;
}

export interface RoleDefinition {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  description: string | null;
  kind: RoleKind;
  is_assignable: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignment {
  id: string;
  user_id: number;
  role_id: string;
  organization_id: string;
  scope_type: ScopeType;
  scope_id: string | null;
  status: AssignmentStatus;
  granted_by: number | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  reason: string | null;
}

export interface ResourceGrant {
  id: string;
  organization_id: string;
  resource_type: string;
  resource_id: string;
  subject_type: GrantSubjectType;
  subject_id: string;
  permission_key: string;
  effect: GrantEffect;
  granted_by: number | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateRolePayload {
  organizationId: string;
  key: string;
  name: string;
  description?: string;
  permissions?: string[];
  groups?: string[];
}

export interface UpdateCustomRolePayload {
  name?: string;
  description?: string;
  is_assignable?: boolean;
}

export interface SetRolePermissionsPayload {
  permissions?: string[];
  groups?: string[];
}

export interface AssignRolePayload {
  userId: number;
  roleId: string;
  organizationId: string;
  scopeType?: ScopeType;
  scopeId?: string | null;
  expiresAt?: string | null;
  reason?: string;
}

export interface CreateResourceGrantPayload {
  organizationId: string;
  resourceType: string;
  resourceId: string;
  subjectType: GrantSubjectType;
  subjectId: string;
  permissionKey: string;
  effect?: GrantEffect;
  expiresAt?: string | null;
}
