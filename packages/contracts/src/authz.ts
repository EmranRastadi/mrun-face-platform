import { ScopeType } from './rbac';

export enum AuthzDecision {
  ALLOW = 'allow',
  DENY = 'deny',
}

export enum AuthzDenyReason {
  UNAUTHENTICATED = 'unauthenticated',
  ACCOUNT_INACTIVE = 'account_inactive',
  PERMISSION_MISSING = 'permission_missing',
  SCOPE_MISMATCH = 'scope_mismatch',
  POLICY_DENIED = 'policy_denied',
  ENTITLEMENT_REQUIRED = 'entitlement_required',
  CAPABILITY_UNSUPPORTED = 'capability_unsupported',
  ORGANIZATION_INACTIVE = 'organization_inactive',
}

export interface AuthzCheckRequest {
  permission: string;
  organizationId?: string | null;
  scopeType?: ScopeType | null;
  scopeId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  attributes?: Record<string, unknown>;
}

export interface AuthzDecisionResult {
  allowed: boolean;
  decision: AuthzDecision;
  reason?: AuthzDenyReason;
  matchedRoleIds?: string[];
  checkedAt: string;
}

export interface TokenContext {
  activeOrganizationId: string | null;
  platformStaff: boolean;
  permissionVersion: number;
}

export interface EffectivePermissions {
  organizationId: string | null;
  platformStaff: boolean;
  permissions: string[];
  roles: string[];
}
