import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssignmentStatus,
  AuthzDecision,
  AuthzDenyReason,
  GrantEffect,
  GrantSubjectType,
  OrganizationKind,
  OrganizationStatus,
  MembershipStatus,
  ScopeType,
  type AuthzCheckRequest,
  type AuthzDecisionResult,
  type TokenContext,
} from '@mrun/contracts';
import { User } from '../../users/users.entity';
import { Organization } from '../entities/organization.entity';
import { OrgUnit } from '../entities/org-unit.entity';
import { RoleAssignment } from '../entities/role-assignment.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RolePermissionGroup } from '../entities/role-permission-group.entity';
import { PermissionGroupItem } from '../entities/permission-group-item.entity';
import { ResourceGrant } from '../entities/resource-grant.entity';
import { AuthorizationPolicy } from '../entities/authorization-policy.entity';
import { ResourceRegistryEntry } from '../entities/resource-registry.entity';
import { PrincipalVersion } from '../entities/principal-version.entity';
import { OrgMembership } from '../entities/org-membership.entity';

interface ScopeContext {
  organizationId: string | null;
  unitPath: string | null;
  scopeType: ScopeType | null;
  scopeId: string | null;
  resourceType: string | null;
  resourceId: string | null;
}

interface CachedDecision {
  expiresAt: number;
  result: AuthzDecisionResult;
}

const CACHE_TTL_MS = 30_000;
const ROLE_CACHE_TTL_MS = 60_000;

@Injectable()
export class AuthzService {
  private readonly decisionCache = new Map<string, CachedDecision>();
  private readonly roleCache = new Map<
    string,
    { expiresAt: number; permissions: Set<string> }
  >();
  private platformOrganization: Organization | null = null;

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrgUnit)
    private readonly orgUnits: Repository<OrgUnit>,
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(RolePermissionGroup)
    private readonly rolePermissionGroups: Repository<RolePermissionGroup>,
    @InjectRepository(PermissionGroupItem)
    private readonly groupItems: Repository<PermissionGroupItem>,
    @InjectRepository(ResourceGrant)
    private readonly grants: Repository<ResourceGrant>,
    @InjectRepository(AuthorizationPolicy)
    private readonly policies: Repository<AuthorizationPolicy>,
    @InjectRepository(ResourceRegistryEntry)
    private readonly registry: Repository<ResourceRegistryEntry>,
    @InjectRepository(PrincipalVersion)
    private readonly versions: Repository<PrincipalVersion>,
    @InjectRepository(OrgMembership)
    private readonly memberships: Repository<OrgMembership>,
  ) {}

  async getPlatformOrganization(): Promise<Organization> {
    if (this.platformOrganization) return this.platformOrganization;
    const organization = await this.organizations.findOne({
      where: { kind: OrganizationKind.PLATFORM },
    });
    if (!organization) {
      throw new Error('Platform organization is not seeded');
    }
    this.platformOrganization = organization;
    return organization;
  }

  /**
   * Computes the org context embedded in the login token. Platform staff get
   * the platform organization; tenants get their primary membership.
   */
  async tokenContext(userId: number): Promise<TokenContext> {
    const platform = await this.getPlatformOrganization();
    const active = await this.assignments.find({
      where: { user_id: userId, status: AssignmentStatus.ACTIVE },
    });
    const now = Date.now();
    const live = active.filter(
      (a) => !a.expires_at || new Date(a.expires_at).getTime() > now,
    );
    const platformStaff = live.some((a) => a.scope_type === ScopeType.PLATFORM);

    let activeOrganizationId: string | null = platformStaff ? platform.id : null;
    if (!platformStaff) {
      const primary = await this.memberships.findOne({
        where: {
          user_id: userId,
          is_primary: true,
          status: MembershipStatus.ACTIVE,
        },
      });
      const fallback = primary
        ? null
        : await this.memberships.findOne({
            where: { user_id: userId, status: MembershipStatus.ACTIVE },
          });
      activeOrganizationId =
        (primary ?? fallback)?.organization_id ?? null;
    }

    const version = await this.versions.findOne({ where: { user_id: userId } });
    return {
      activeOrganizationId,
      platformStaff,
      permissionVersion: version?.permission_version ?? 1,
    };
  }

  async check(
    userId: number,
    request: AuthzCheckRequest,
  ): Promise<AuthzDecisionResult> {
    const cacheKey = [
      userId,
      request.permission,
      request.organizationId ?? '',
      request.scopeType ?? '',
      request.scopeId ?? '',
      request.resourceType ?? '',
      request.resourceId ?? '',
    ].join('|');
    const cached = this.decisionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await this.evaluate(userId, request);
    this.decisionCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    });
    return result;
  }

  private async evaluate(
    userId: number,
    request: AuthzCheckRequest,
  ): Promise<AuthzDecisionResult> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      return this.deny(AuthzDenyReason.UNAUTHENTICATED);
    }
    if (!user.is_active) {
      return this.deny(AuthzDenyReason.ACCOUNT_INACTIVE);
    }

    const platform = await this.getPlatformOrganization();
    const scope = await this.resolveScope(request);
    if (!scope) {
      return this.deny(AuthzDenyReason.SCOPE_MISMATCH);
    }

    if (scope.organizationId) {
      const organization = await this.organizations.findOne({
        where: { id: scope.organizationId },
      });
      if (!organization || organization.status !== OrganizationStatus.ACTIVE) {
        return this.deny(AuthzDenyReason.ORGANIZATION_INACTIVE);
      }
    }

    const assignments = await this.activeAssignments(userId);
    const covered: RoleAssignment[] = [];
    for (const assignment of assignments) {
      if (await this.covers(assignment, scope)) {
        covered.push(assignment);
      }
    }

    const roleIds = [...new Set(covered.map((a) => a.role_id))];
    const rolePermissions = await this.loadRolePermissions(roleIds);

    // Explicit deny grants win over any role.
    if (await this.hasGrant(userId, roleIds, scope, request.permission, GrantEffect.DENY)) {
      return this.deny(AuthzDenyReason.POLICY_DENIED);
    }

    const annotate = (allowed: boolean, reason?: AuthzDenyReason): AuthzDecisionResult => ({
      allowed,
      decision: allowed ? AuthzDecision.ALLOW : AuthzDecision.DENY,
      ...(reason ? { reason } : {}),
      matchedRoleIds: roleIds,
      checkedAt: new Date().toISOString(),
    });

    // Attribute policies (deny first, then explicit allow).
    const policyResult = await this.evaluatePolicies(userId, scope, request);
    if (policyResult === 'deny') {
      return annotate(false, AuthzDenyReason.POLICY_DENIED);
    }

    const hasWildcard = roleIds.some((id) => rolePermissions.get(id)?.has('*'));
    const hasPermission = roleIds.some((id) =>
      rolePermissions.get(id)?.has(request.permission),
    );

    if (hasWildcard || hasPermission) {
      // A platform-scoped role cannot be used to satisfy a tenant-only check
      // outside the platform organization.
      if (!scope.organizationId && !covered.some((a) => a.scope_type === ScopeType.PLATFORM)) {
        return annotate(false, AuthzDenyReason.SCOPE_MISMATCH);
      }
      return annotate(true);
    }

    // Per-resource allow grants can authorize without a matching role.
    if (await this.hasGrant(userId, roleIds, scope, request.permission, GrantEffect.ALLOW)) {
      return annotate(true);
    }

    if (policyResult === 'allow') {
      return annotate(true);
    }

    return annotate(false, AuthzDenyReason.PERMISSION_MISSING);
  }

  private async resolveScope(
    request: AuthzCheckRequest,
  ): Promise<ScopeContext | null> {
    let organizationId = request.organizationId ?? null;
    let scopeType = request.scopeType ?? null;
    let scopeId = request.scopeId ?? null;
    let resourceType = request.resourceType ?? null;
    let resourceId = request.resourceId ?? null;
    let unitPath: string | null = null;

    if (resourceType && resourceId) {
      const resource = await this.registry.findOne({ where: { resource_id: resourceId } });
      if (!resource || resource.resource_type !== resourceType) {
        return null;
      }
      if (organizationId && resource.organization_id !== organizationId) {
        return null;
      }
      organizationId = resource.organization_id;
      if (resource.org_unit_id) {
        const unit = await this.orgUnits.findOne({
          where: { id: resource.org_unit_id },
        });
        unitPath = unit?.path ?? null;
      }
    }

    if (scopeType === ScopeType.ORG_UNIT && scopeId) {
      const unit = await this.orgUnits.findOne({ where: { id: scopeId } });
      if (!unit) return null;
      if (organizationId && unit.organization_id !== organizationId) return null;
      organizationId = unit.organization_id;
      unitPath = unit.path;
    }

    if (organizationId && !unitPath && scopeType === ScopeType.ORGANIZATION) {
      // Organization-wide: unit path stays null, covered by org-scope roles.
    }

    return {
      organizationId,
      unitPath,
      scopeType,
      scopeId,
      resourceType,
      resourceId,
    };
  }

  private async activeAssignments(userId: number): Promise<RoleAssignment[]> {
    const all = await this.assignments.find({
      where: { user_id: userId, status: AssignmentStatus.ACTIVE },
    });
    const now = Date.now();
    return all.filter(
      (a) => !a.expires_at || new Date(a.expires_at).getTime() > now,
    );
  }

  private async covers(
    assignment: RoleAssignment,
    scope: ScopeContext,
  ): Promise<boolean> {
    if (assignment.scope_type === ScopeType.PLATFORM) {
      return true;
    }
    if (!scope.organizationId) {
      return false;
    }
    if (assignment.organization_id !== scope.organizationId) {
      return false;
    }
    if (assignment.scope_type === ScopeType.ORGANIZATION) {
      return true;
    }
    if (assignment.scope_type === ScopeType.ORG_UNIT) {
      if (!scope.unitPath || !assignment.scope_id) return false;
      const unit = await this.orgUnits.findOne({
        where: { id: assignment.scope_id },
      });
      if (!unit || unit.organization_id !== scope.organizationId) return false;
      return (
        scope.unitPath === unit.path ||
        scope.unitPath.startsWith(`${unit.path}/`)
      );
    }
    if (assignment.scope_type === ScopeType.ROBOT) {
      return (
        scope.resourceType === 'robot' &&
        scope.resourceId === assignment.scope_id
      );
    }
    return false;
  }

  private async loadRolePermissions(
    roleIds: string[],
  ): Promise<Map<string, Set<string>>> {
    const result = new Map<string, Set<string>>();
    if (!roleIds.length) return result;

    const uncached: string[] = [];
    for (const id of roleIds) {
      const cached = this.roleCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        result.set(id, cached.permissions);
      } else {
        uncached.push(id);
      }
    }
    if (!uncached.length) return result;

    for (const id of uncached) result.set(id, new Set<string>());

    const direct = await this.rolePermissions.find({
      where: { role_id: In(uncached) },
    });
    for (const row of direct) {
      result.get(row.role_id)?.add(row.permission_key);
    }

    const groupLinks = await this.rolePermissionGroups.find({
      where: { role_id: In(uncached) },
    });
    const groupIds = [...new Set(groupLinks.map((g) => g.group_id))];
    if (groupIds.length) {
      const items = await this.groupItems.find({
        where: { group_id: In(groupIds) },
      });
      const byGroup = new Map<string, string[]>();
      for (const item of items) {
        const list = byGroup.get(item.group_id) ?? [];
        list.push(item.permission_key);
        byGroup.set(item.group_id, list);
      }
      for (const link of groupLinks) {
        const perms = byGroup.get(link.group_id) ?? [];
        for (const key of perms) result.get(link.role_id)?.add(key);
      }
    }

    for (const id of uncached) {
      this.roleCache.set(id, {
        expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
        permissions: result.get(id) ?? new Set(),
      });
    }
    return result;
  }

  private async hasGrant(
    userId: number,
    roleIds: string[],
    scope: ScopeContext,
    permission: string,
    effect: GrantEffect,
  ): Promise<boolean> {
    if (!scope.organizationId) return false;
    const rows = await this.grants.find({
      where: {
        organization_id: scope.organizationId,
        permission_key: permission,
        effect,
      },
    });
    if (!rows.length) return false;

    const now = Date.now();
    const unitIds = scope.unitPath ? scope.unitPath.split('/').filter(Boolean) : [];
    return rows.some((grant) => {
      if (grant.expires_at && new Date(grant.expires_at).getTime() <= now) {
        return false;
      }
      if (grant.resource_type !== (scope.resourceType ?? 'organization')) {
        return false;
      }
      if (grant.resource_id !== (scope.resourceId ?? scope.organizationId)) {
        return false;
      }
      if (grant.subject_type === GrantSubjectType.USER) {
        return grant.subject_id === String(userId);
      }
      if (grant.subject_type === GrantSubjectType.ROLE) {
        return roleIds.includes(grant.subject_id);
      }
      return unitIds.includes(grant.subject_id);
    });
  }

  private async evaluatePolicies(
    userId: number,
    scope: ScopeContext,
    request: AuthzCheckRequest,
  ): Promise<'allow' | 'deny' | 'none'> {
    const rows = await this.policies.find({
      where: [
        { permission_key: request.permission, enabled: true },
        { permission_key: '*', enabled: true },
      ],
      order: { priority: 'DESC' },
    });
    if (!rows.length) return 'none';

    const facts = {
      user: { id: userId },
      resource: {
        type: scope.resourceType,
        id: scope.resourceId,
        organizationId: scope.organizationId,
        unitPath: scope.unitPath,
      },
      context: request.attributes ?? {},
    };

    for (const policy of rows) {
      if (
        policy.organization_id &&
        policy.organization_id !== scope.organizationId
      ) {
        continue;
      }
      if (!this.matches(policy.condition, facts)) continue;
      return policy.effect === GrantEffect.DENY ? 'deny' : 'allow';
    }
    return 'none';
  }

  private matches(condition: unknown, facts: Record<string, unknown>): boolean {
    if (!condition || typeof condition !== 'object') return false;
    const node = condition as Record<string, unknown>;

    if (Array.isArray(node.all)) {
      return node.all.every((child) => this.matches(child, facts));
    }
    if (Array.isArray(node.any)) {
      return node.any.some((child) => this.matches(child, facts));
    }
    if (node.not) {
      return !this.matches(node.not, facts);
    }
    if (Array.isArray(node.eq)) {
      const [path, value] = node.eq as [string, unknown];
      return this.readPath(facts, path) === value;
    }
    if (Array.isArray(node.neq)) {
      const [path, value] = node.neq as [string, unknown];
      return this.readPath(facts, path) !== value;
    }
    if (Array.isArray(node.in)) {
      const [path, values] = node.in as [string, unknown[]];
      if (!Array.isArray(values)) return false;
      const actual = this.readPath(facts, path);
      if (Array.isArray(actual)) {
        return actual.some((value) => values.includes(value));
      }
      return values.includes(actual);
    }
    if (Array.isArray(node.contains)) {
      const [path, value] = node.contains as [string, unknown];
      const actual = this.readPath(facts, path);
      if (Array.isArray(actual)) return actual.includes(value);
      return typeof actual === 'string' && actual.includes(String(value));
    }
    if (Array.isArray(node.exists)) {
      const [path] = node.exists as [string];
      return this.readPath(facts, path) !== undefined;
    }
    return false;
  }

  private readPath(facts: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, facts);
  }

  async effectivePermissions(
    userId: number,
    organizationId?: string | null,
  ): Promise<{ permissions: string[]; roles: string[] }> {
    const assignments = await this.activeAssignments(userId);
    const relevant = assignments.filter((a) => {
      if (a.scope_type === ScopeType.PLATFORM) return true;
      if (!organizationId) return false;
      return a.organization_id === organizationId;
    });
    const roleIds = [...new Set(relevant.map((a) => a.role_id))];
    const perms = await this.loadRolePermissions(roleIds);
    const union = new Set<string>();
    for (const roleId of roleIds) {
      for (const key of perms.get(roleId) ?? []) union.add(key);
    }
    return { permissions: [...union].sort(), roles: roleIds };
  }

  invalidate(userId?: number): void {
    this.roleCache.clear();
    if (userId === undefined) {
      this.decisionCache.clear();
      return;
    }
    const prefix = `${userId}|`;
    for (const key of this.decisionCache.keys()) {
      if (key.startsWith(prefix)) this.decisionCache.delete(key);
    }
  }

  async bumpPermissionVersion(userId: number): Promise<void> {
    const existing = await this.versions.findOne({ where: { user_id: userId } });
    if (existing) {
      existing.permission_version += 1;
      await this.versions.save(existing);
    } else {
      await this.versions.save(
        this.versions.create({ user_id: userId, permission_version: 2 }),
      );
    }
    this.invalidate(userId);
  }

  private deny(reason: AuthzDenyReason): AuthzDecisionResult {
    return {
      allowed: false,
      decision: AuthzDecision.DENY,
      reason,
      checkedAt: new Date().toISOString(),
    };
  }
}
