import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  AssignmentStatus,
  OrganizationKind,
  RoleKind,
  ScopeType,
  type RoleAssignment as RoleAssignmentContract,
} from '@mrun/contracts';
import { RoleAssignment } from '../entities/role-assignment.entity';
import { Role } from '../entities/role.entity';
import { Organization } from '../entities/organization.entity';
import { OrgUnit } from '../entities/org-unit.entity';
import { ResourceRegistryEntry } from '../entities/resource-registry.entity';
import { User } from '../../users/users.entity';
import { AssignRoleDto } from '../dto/iam.dto';
import { AuthzService } from '../authz/authz.service';
import { RolesService } from './roles.service';
import { SYSTEM_ROLES, SystemRoleKey } from '../constants/system-roles';

export interface AssignmentFilters {
  userId?: number;
  organizationId?: string;
  roleId?: string;
  status?: AssignmentStatus;
  limit?: number;
}

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrgUnit)
    private readonly orgUnits: Repository<OrgUnit>,
    @InjectRepository(ResourceRegistryEntry)
    private readonly registry: Repository<ResourceRegistryEntry>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly rolesService: RolesService,
    private readonly authz: AuthzService,
  ) {}

  async list(filters: AssignmentFilters): Promise<RoleAssignmentContract[]> {
    const qb = this.assignments.createQueryBuilder('a');
    if (filters.userId) qb.andWhere('a.user_id = :userId', { userId: filters.userId });
    if (filters.organizationId) {
      qb.andWhere('a.organization_id = :organizationId', {
        organizationId: filters.organizationId,
      });
    }
    if (filters.roleId) qb.andWhere('a.role_id = :roleId', { roleId: filters.roleId });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    qb.orderBy('a.granted_at', 'DESC').limit(Math.min(filters.limit ?? 200, 500));
    const rows = await qb.getMany();
    return rows.map((row) => this.toContract(row));
  }

  async assign(dto: AssignRoleDto, actorId: number): Promise<RoleAssignmentContract> {
    const [role, organization, user] = await Promise.all([
      this.rolesService.getEntity(dto.roleId),
      this.organizations.findOne({ where: { id: dto.organizationId } }),
      this.users.findOne({ where: { id: dto.userId } }),
    ]);
    if (!organization) {
      throw new NotFoundException(`Organization ${dto.organizationId} not found`);
    }
    if (!user || !user.is_active) {
      throw new BadRequestException('Target user does not exist or is inactive');
    }
    if (!role.is_assignable) {
      throw new BadRequestException(`Role "${role.key}" is not assignable`);
    }
    if (role.organization_id && role.organization_id !== organization.id) {
      throw new BadRequestException('Role belongs to a different organization');
    }
    if (
      organization.kind !== OrganizationKind.PLATFORM &&
      this.isPlatformRole(role) &&
      !this.isPlatformOrganization(organization)
    ) {
      throw new BadRequestException('Platform roles cannot be assigned in a tenant');
    }

    const scopeType =
      dto.scopeType ??
      (this.isPlatformOrganization(organization)
        ? ScopeType.PLATFORM
        : ScopeType.ORGANIZATION);
    const scopeId = dto.scopeId ?? null;

    await this.validateScope(actorId, organization, scopeType, scopeId);
    await this.assertCanGrantRole(actorId, organization.id, role);

    const duplicate = await this.assignments.findOne({
      where: {
        user_id: dto.userId,
        role_id: dto.roleId,
        organization_id: organization.id,
        scope_type: scopeType,
        scope_id: scopeId === null ? IsNull() : scopeId,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (duplicate) {
      throw new ConflictException('User already has this active assignment');
    }

    const assignment = await this.assignments.save(
      this.assignments.create({
        user_id: dto.userId,
        role_id: role.id,
        organization_id: organization.id,
        scope_type: scopeType,
        scope_id: scopeId,
        status: AssignmentStatus.ACTIVE,
        granted_by: actorId,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reason: dto.reason ?? null,
      }),
    );
    await this.authz.bumpPermissionVersion(dto.userId);
    return this.toContract(assignment);
  }

  async revoke(id: string, actorId: number): Promise<RoleAssignmentContract> {
    const assignment = await this.assignments.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException(`Assignment ${id} not found`);
    if (assignment.status !== AssignmentStatus.ACTIVE) {
      return this.toContract(assignment);
    }

    const role = await this.rolesService.getEntity(assignment.role_id);
    const organization = await this.organizations.findOne({
      where: { id: assignment.organization_id },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const required =
      assignment.scope_type === ScopeType.PLATFORM
        ? 'roles:assign_platform'
        : 'roles:assign';
    const decision = await this.authz.check(actorId, {
      permission: required,
      organizationId: organization.id,
      scopeType: assignment.scope_type,
      scopeId: assignment.scope_id,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(`Missing ${required} permission`);
    }

    await this.assertNotLastCriticalAssignment(assignment, role, organization);

    assignment.status = AssignmentStatus.REVOKED;
    assignment.revoked_at = new Date();
    await this.assignments.save(assignment);
    await this.authz.bumpPermissionVersion(assignment.user_id);
    return this.toContract(assignment);
  }

  private async validateScope(
    actorId: number,
    organization: Organization,
    scopeType: ScopeType,
    scopeId: string | null,
  ): Promise<void> {
    if (scopeType === ScopeType.PLATFORM) {
      if (!this.isPlatformOrganization(organization)) {
        throw new BadRequestException('Platform scope requires the platform organization');
      }
      const decision = await this.authz.check(actorId, {
        permission: 'roles:assign_platform',
        organizationId: organization.id,
        scopeType: ScopeType.PLATFORM,
      });
      if (!decision.allowed) {
        throw new ForbiddenException('Missing roles:assign_platform permission');
      }
      return;
    }

    if (scopeType === ScopeType.ORGANIZATION) {
      const decision = await this.authz.check(actorId, {
        permission: 'roles:assign',
        organizationId: organization.id,
      });
      if (!decision.allowed) {
        throw new ForbiddenException('Missing roles:assign permission');
      }
      return;
    }

    if (!scopeId) {
      throw new BadRequestException(`scopeId is required for ${scopeType} scope`);
    }

    if (scopeType === ScopeType.ORG_UNIT) {
      const unit = await this.orgUnits.findOne({ where: { id: scopeId } });
      if (!unit || unit.organization_id !== organization.id) {
        throw new BadRequestException('Org unit does not belong to this organization');
      }
      const decision = await this.authz.check(actorId, {
        permission: 'roles:assign',
        organizationId: organization.id,
        scopeType: ScopeType.ORG_UNIT,
        scopeId,
      });
      if (!decision.allowed) {
        throw new ForbiddenException(
          'You cannot assign roles outside your organizational scope',
        );
      }
      return;
    }

    if (scopeType === ScopeType.ROBOT) {
      const resource = await this.registry.findOne({ where: { resource_id: scopeId } });
      if (!resource || resource.organization_id !== organization.id) {
        throw new BadRequestException('Robot does not belong to this organization');
      }
      const decision = await this.authz.check(actorId, {
        permission: 'roles:assign',
        organizationId: organization.id,
        resourceType: 'robot',
        resourceId: scopeId,
      });
      if (!decision.allowed) {
        throw new ForbiddenException('You cannot assign roles for this robot');
      }
      return;
    }
  }

  private async assertCanGrantRole(
    actorId: number,
    organizationId: string,
    role: Role,
  ): Promise<void> {
    const executed = await this.rolesService.readPermissions([role.id]);
    const rolePermissions = [...(executed.permissions.get(role.id) ?? [])];
    const effective = await this.authz.effectivePermissions(actorId, organizationId);
    if (effective.permissions.includes('*')) return;
    if (rolePermissions.includes('*')) {
      throw new ForbiddenException('Only a super admin can assign the wildcard role');
    }
    const missing = rolePermissions.filter(
      (key) => !effective.permissions.includes(key),
    );
    if (missing.length) {
      throw new ForbiddenException(
        `Cannot assign a role with permissions you do not hold: ${missing.join(', ')}`,
      );
    }
  }

  private async assertNotLastCriticalAssignment(
    assignment: RoleAssignment,
    role: Role,
    organization: Organization,
  ): Promise<void> {
    if (role.kind !== RoleKind.SYSTEM) return;

    if (role.key === SystemRoleKey.SUPER_ADMIN) {
      const total = await this.assignments.count({
        where: {
          role_id: role.id,
          scope_type: ScopeType.PLATFORM,
          status: AssignmentStatus.ACTIVE,
        },
      });
      if (total <= 1) {
        throw new BadRequestException('Cannot revoke the last super admin');
      }
    }

    if (
      role.key === SystemRoleKey.ORG_OWNER &&
      organization.kind === OrganizationKind.CUSTOMER
    ) {
      const total = await this.assignments.count({
        where: {
          role_id: role.id,
          organization_id: organization.id,
          status: AssignmentStatus.ACTIVE,
        },
      });
      if (total <= 1) {
        throw new BadRequestException(
          'Cannot revoke the last owner of a customer organization',
        );
      }
    }
  }

  private isPlatformRole(role: Role): boolean {
    const definition = SYSTEM_ROLES.find((r) => r.key === role.key);
    return definition ? definition.tier === 'platform' : false;
  }

  private isPlatformOrganization(organization: Organization): boolean {
    return organization.kind === OrganizationKind.PLATFORM;
  }

  private toContract(row: RoleAssignment): RoleAssignmentContract {
    return {
      id: row.id,
      user_id: row.user_id,
      role_id: row.role_id,
      organization_id: row.organization_id,
      scope_type: row.scope_type,
      scope_id: row.scope_id,
      status: row.status,
      granted_by: row.granted_by,
      granted_at: row.granted_at.toISOString(),
      expires_at: row.expires_at ? row.expires_at.toISOString() : null,
      revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
      reason: row.reason,
    };
  }
}
