/**
 * Organization / tenancy contracts.
 *
 * `platform` is the internal MRUN organization (staff). `customer` organizations
 * are tenants. `partner` organizations provide support/repair services.
 */
export enum OrganizationKind {
  PLATFORM = 'platform',
  CUSTOMER = 'customer',
  PARTNER = 'partner',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export enum OrgUnitKind {
  DEPARTMENT = 'department',
  TEAM = 'team',
  UNIT = 'unit',
  SERVICE_CENTER = 'service_center',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  INVITED = 'invited',
  SUSPENDED = 'suspended',
  REMOVED = 'removed',
}

export interface Organization {
  id: string;
  kind: OrganizationKind;
  slug: string;
  name: string;
  parent_id: string | null;
  status: OrganizationStatus;
  timezone: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  organization_id: string;
  user_id: number;
  status: MembershipStatus;
  title: string | null;
  employee_no: string | null;
  is_primary: boolean;
  joined_at: string;
  left_at: string | null;
}

export interface OrgUnit {
  id: string;
  organization_id: string;
  parent_id: string | null;
  kind: OrgUnitKind;
  name: string;
  code: string | null;
  path: string;
  depth: number;
  manager_user_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationPayload {
  kind: OrganizationKind;
  slug: string;
  name: string;
  parent_id?: string | null;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationPayload {
  name?: string;
  status?: OrganizationStatus;
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface AddMemberPayload {
  userId?: number;
  username?: string;
  email?: string;
  title?: string;
  employee_no?: string;
  is_primary?: boolean;
}

export interface CreateOrgUnitPayload {
  parent_id?: string | null;
  kind: OrgUnitKind;
  name: string;
  code?: string;
  manager_user_id?: number | null;
}

export interface UpdateOrgUnitPayload {
  name?: string;
  code?: string;
  manager_user_id?: number | null;
  status?: string;
}
