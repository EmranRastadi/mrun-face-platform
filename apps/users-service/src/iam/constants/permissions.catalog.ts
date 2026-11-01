import {
  PermissionTier,
  type PermissionDefinition,
  type PermissionGroupDefinition,
} from '@mrun/contracts';

const PLATFORM = PermissionTier.PLATFORM;
const TENANT = PermissionTier.TENANT;

const p = (
  key: string,
  resource: string,
  action: string,
  description: string,
  tier: PermissionTier,
): PermissionDefinition => ({
  key,
  resource,
  action,
  description,
  tier,
  is_system: true,
});

/**
 * Canonical permission catalog. Adding a permission here and re-deploying
 * upserts it; existing roles are unaffected until granted explicitly.
 */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  p('*', '*', '*', 'Wildcard — grants every permission (platform super admin)', PLATFORM),

  // Platform administration
  p('organizations:read', 'organizations', 'read', 'View organizations and tenants', PLATFORM),
  p('organizations:manage', 'organizations', 'manage', 'Create, update, suspend organizations', PLATFORM),
  p('platform.users:read', 'platform.users', 'read', 'View platform staff accounts', PLATFORM),
  p('platform.users:manage', 'platform.users', 'manage', 'Manage platform staff accounts', PLATFORM),
  p('platform.units:manage', 'platform.units', 'manage', 'Manage platform departments and teams', PLATFORM),
  p('partners:read', 'partners', 'read', 'View partner organizations', PLATFORM),
  p('partners:manage', 'partners', 'manage', 'Manage partner organizations and contracts', PLATFORM),
  p('plans:manage', 'plans', 'manage', 'Create and version commercial plans', PLATFORM),
  p('subscriptions:manage', 'subscriptions', 'manage', 'Create, change and cancel subscriptions', PLATFORM),
  p('audit:export', 'audit', 'export', 'Export audit records', PLATFORM),
  p('robot_models:manage', 'robot_models', 'manage', 'Manage robot models and capabilities', PLATFORM),
  p('robots:provision', 'robots', 'provision', 'Register and commission robots', PLATFORM),
  p('support.tickets:manage', 'support.tickets', 'manage', 'Manage any support ticket', PLATFORM),
  p('support.tickets:assign', 'support.tickets', 'assign', 'Assign tickets to agents and teams', PLATFORM),
  p('repairs:manage', 'repairs', 'manage', 'Manage repair requests and work orders', PLATFORM),
  p('appointments:manage', 'appointments', 'manage', 'Manage service appointments', PLATFORM),
  p('service_centers:manage', 'service_centers', 'manage', 'Manage service centers and coverage', PLATFORM),
  p('roles:assign_platform', 'roles', 'assign_platform', 'Assign platform-scoped roles', PLATFORM),

  // Tenant / organization administration
  p('org.profile:read', 'org.profile', 'read', 'View own organization profile', TENANT),
  p('org.profile:manage', 'org.profile', 'manage', 'Update own organization profile', TENANT),
  p('org.members:read', 'org.members', 'read', 'View organization members', TENANT),
  p('org.members:manage', 'org.members', 'manage', 'Invite, update and remove organization members', TENANT),
  p('org.units:read', 'org.units', 'read', 'View departments and teams', TENANT),
  p('org.units:manage', 'org.units', 'manage', 'Manage departments, teams and memberships', TENANT),
  p('roles:read', 'roles', 'read', 'View roles and permissions', TENANT),
  p('roles:manage', 'roles', 'manage', 'Create and edit custom roles', TENANT),
  p('roles:assign', 'roles', 'assign', 'Assign and revoke roles inside own scope', TENANT),
  p('subscriptions:read', 'subscriptions', 'read', 'View subscriptions and entitlements', TENANT),
  p('subscriptions:assign', 'subscriptions', 'assign', 'Assign seats and robots to subscriptions', TENANT),
  p('usage:read', 'usage', 'read', 'View usage and quota consumption', TENANT),
  p('audit:read', 'audit', 'read', 'View audit records for own organization', TENANT),
  p('analytics:read', 'analytics', 'read', 'View dashboards and analytics', TENANT),
  p('notifications:read', 'notifications', 'read', 'View notifications', TENANT),

  // Fleet
  p('robots:read', 'robots', 'read', 'View robots and their status', TENANT),
  p('robots:manage', 'robots', 'manage', 'Update robots, assignments and settings', TENANT),
  p('robots:control', 'robots', 'control', 'Send control commands to robots', TENANT),
  p('cameras:read', 'cameras', 'read', 'View cameras and streams', TENANT),
  p('cameras:manage', 'cameras', 'manage', 'Configure cameras and streams', TENANT),

  // Support and service
  p('support.tickets:read', 'support.tickets', 'read', 'View support tickets', TENANT),
  p('support.tickets:create', 'support.tickets', 'create', 'Open support tickets', TENANT),
  p('support.tickets:comment', 'support.tickets', 'comment', 'Reply to support tickets', TENANT),
  p('support.tickets:escalate', 'support.tickets', 'escalate', 'Escalate tickets to the next support level', TENANT),
  p('repairs:request', 'repairs', 'request', 'Request repair or maintenance', TENANT),
  p('repairs:read', 'repairs', 'read', 'View repair requests', TENANT),
  p('appointments:request', 'appointments', 'request', 'Request a service appointment', TENANT),
  p('appointments:read', 'appointments', 'read', 'View service appointments', TENANT),
];

export const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((x) => x.key));

export const TENANT_PERMISSION_KEYS = PERMISSION_CATALOG.filter(
  (x) => x.tier === TENANT,
).map((x) => x.key);

/**
 * Reusable permission bundles. Platform groups have `organization_id = NULL`;
 * tenants may create their own later.
 */
export const PERMISSION_GROUPS: PermissionGroupDefinition[] = [
  {
    key: 'fleet_read',
    name: 'Fleet read',
    description: 'Read robots, cameras and analytics',
    permissions: ['robots:read', 'cameras:read', 'analytics:read'],
    organization_id: null,
  },
  {
    key: 'fleet_manage',
    name: 'Fleet manage',
    description: 'Manage robots and cameras',
    permissions: ['robots:manage', 'cameras:manage'],
    organization_id: null,
  },
  {
    key: 'support_basic',
    name: 'Support basic',
    description: 'Open and reply to tickets',
    permissions: [
      'support.tickets:create',
      'support.tickets:read',
      'support.tickets:comment',
    ],
    organization_id: null,
  },
  {
    key: 'support_full',
    name: 'Support full',
    description: 'Tickets, escalation, repairs and appointments',
    permissions: [
      'support.tickets:create',
      'support.tickets:read',
      'support.tickets:comment',
      'support.tickets:escalate',
      'repairs:request',
      'repairs:read',
      'appointments:request',
      'appointments:read',
    ],
    organization_id: null,
  },
  {
    key: 'org_admin_core',
    name: 'Organization administration',
    description: 'Profile, members, units and role administration',
    permissions: [
      'org.profile:read',
      'org.profile:manage',
      'org.members:read',
      'org.members:manage',
      'org.units:read',
      'org.units:manage',
      'roles:read',
      'roles:manage',
      'roles:assign',
    ],
    organization_id: null,
  },
  {
    key: 'billing_read',
    name: 'Billing read',
    description: 'Subscriptions and usage',
    permissions: ['subscriptions:read', 'usage:read'],
    organization_id: null,
  },
  {
    key: 'platform_ops',
    name: 'Platform operations',
    description: 'Tenant overview and fleet operations',
    permissions: [
      'organizations:read',
      'robots:read',
      'robots:manage',
      'robots:provision',
      'audit:read',
    ],
    organization_id: null,
  },
];
