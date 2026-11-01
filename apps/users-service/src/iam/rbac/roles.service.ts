import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  AssignmentStatus,
  OrganizationKind,
  RoleKind,
  type RoleDefinition,
} from '@mrun/contracts';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { RolePermissionGroup } from '../entities/role-permission-group.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { PermissionGroupItem } from '../entities/permission-group-item.entity';
import { RoleAssignment } from '../entities/role-assignment.entity';
import { Organization } from '../entities/organization.entity';
import { PermissionsService } from './permissions.service';
import { AuthzService } from '../authz/authz.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from '../dto/iam.dto';
import { SYSTEM_ROLES, SystemRoleKey } from '../constants/system-roles';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissions: Repository<RolePermission>,
    @InjectRepository(RolePermissionGroup)
    private readonly roleGroups: Repository<RolePermissionGroup>,
    @InjectRepository(PermissionGroup)
    private readonly groups: Repository<PermissionGroup>,
    @InjectRepository(PermissionGroupItem)
    private readonly groupItems: Repository<PermissionGroupItem>,
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly permissionsService: PermissionsService,
    private readonly authz: AuthzService,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    organizationId: string | null,
    includeSystem = true,
  ): Promise<RoleDefinition[]> {
    const where = includeSystem
      ? organizationId
        ? [{ organization_id: organizationId }, { organization_id: IsNull() }]
        : [{ organization_id: IsNull() }]
      : organizationId
        ? [{ organization_id: organizationId }]
        : [];
    const rows = where.length ? await this.roles.find({ where, order: { key: 'ASC' } }) : [];
    return rows.map((role) => this.toDefinition(role));
  }

  async get(id: string): Promise<RoleDefinition & { permissions: string[]; groups: string[] }> {
    const role = await this.getEntity(id);
    const { permissions, groups } = await this.readPermissions([role.id]);
    return {
      ...this.toDefinition(role),
      permissions: [...(permissions.get(role.id) ?? [])].sort(),
      groups: groups.get(role.id) ?? [],
    };
  }

  async create(dto: CreateRoleDto, actorId: number): Promise<RoleDefinition> {
    const organization = await this.organizations.findOne({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organization ${dto.organizationId} not found`);
    }
    if (organization.kind === OrganizationKind.PLATFORM) {
      throw new BadRequestException(
        'Platform roles are managed as system roles, not custom roles',
      );
    }

    const existing = await this.roles.findOne({
      where: { organization_id: dto.organizationId, key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.key}" already exists`);
    }

    const permissionKeys = dto.permissions ?? [];
    await this.permissionsService.assertTenantGrantable(permissionKeys);
    const groupIds = await this.resolveGroupIds(dto.groups ?? [], dto.organizationId);
    await this.assertActorCanGrant(actorId, dto.organizationId, [
      ...permissionKeys,
      ...(await this.groupPermissionKeys(groupIds)),
    ]);

    const role = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Role, {
          organization_id: dto.organizationId,
          key: dto.key,
          name: dto.name,
          description: dto.description ?? null,
          kind: RoleKind.CUSTOM,
          is_assignable: true,
          created_by: actorId,
        }),
      );
      if (permissionKeys.length) {
        await manager.save(
          permissionKeys.map((key) =>
            manager.create(RolePermission, {
              role_id: saved.id,
              permission_key: key,
            }),
          ),
        );
      }
      if (groupIds.length) {
        await manager.save(
          groupIds.map((groupId) =>
            manager.create(RolePermissionGroup, {
              role_id: saved.id,
              group_id: groupId,
            }),
          ),
        );
      }
      return saved;
    });

    this.authz.invalidate();
    return this.toDefinition(role);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: number): Promise<RoleDefinition> {
    const role = await this.getEntity(id);
    this.assertMutable(role);
    await this.assertActorManagesRole(actorId, role);
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.is_assignable !== undefined) role.is_assignable = dto.is_assignable;
    await this.roles.save(role);
    this.authz.invalidate();
    return this.toDefinition(role);
  }

  async setPermissions(
    id: string,
    dto: SetRolePermissionsDto,
    actorId: number,
  ): Promise<{ permissions: string[]; groups: string[] }> {
    const role = await this.getEntity(id);
    this.assertMutable(role);
    await this.assertActorManagesRole(actorId, role);

    const permissionKeys = dto.permissions ?? [];
    await this.permissionsService.assertTenantGrantable(permissionKeys);
    const groupIds = await this.resolveGroupIds(dto.groups ?? [], role.organization_id);
    await this.assertActorCanGrant(actorId, role.organization_id ?? '', [
      ...permissionKeys,
      ...(await this.groupPermissionKeys(groupIds)),
    ]);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RolePermission, { role_id: role.id });
      await manager.delete(RolePermissionGroup, { role_id: role.id });
      if (permissionKeys.length) {
        await manager.save(
          permissionKeys.map((key) =>
            manager.create(RolePermission, {
              role_id: role.id,
              permission_key: key,
            }),
          ),
        );
      }
      if (groupIds.length) {
        await manager.save(
          groupIds.map((groupId) =>
            manager.create(RolePermissionGroup, {
              role_id: role.id,
              group_id: groupId,
            }),
          ),
        );
      }
    });

    this.authz.invalidate();
    return this.get(role.id).then((r) => ({
      permissions: r.permissions,
      groups: r.groups,
    }));
  }

  async remove(id: string, actorId: number): Promise<void> {
    const role = await this.getEntity(id);
    this.assertMutable(role);
    await this.assertActorManagesRole(actorId, role);
    const active = await this.assignments.count({
      where: { role_id: role.id, status: AssignmentStatus.ACTIVE },
    });
    if (active > 0) {
      throw new ConflictException(
        `Role has ${active} active assignment(s); revoke them first`,
      );
    }
    await this.roles.delete(role.id);
    this.authz.invalidate();
  }

  async getEntity(id: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return role;
  }

  async findByKey(key: string): Promise<Role | null> {
    return this.roles.findOne({ where: { key, organization_id: IsNull() } });
  }

  async readPermissions(
    roleIds: string[],
  ): Promise<{ permissions: Map<string, Set<string>>; groups: Map<string, string[]> }> {
    const permissions = new Map<string, Set<string>>();
    const groups = new Map<string, string[]>();
    for (const id of roleIds) {
      permissions.set(id, new Set());
      groups.set(id, []);
    }
    if (!roleIds.length) return { permissions, groups };

    const direct = await this.rolePermissions.find({
      where: { role_id: In(roleIds) },
    });
    for (const row of direct) permissions.get(row.role_id)?.add(row.permission_key);

    const links = await this.roleGroups.find({ where: { role_id: In(roleIds) } });
    for (const link of links) groups.get(link.role_id)?.push(link.group_id);

    const groupIds = [...new Set(links.map((l) => l.group_id))];
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
      for (const link of links) {
        for (const key of byGroup.get(link.group_id) ?? []) {
          permissions.get(link.role_id)?.add(key);
        }
      }
    }
    return { permissions, groups };
  }

  private toDefinition(role: Role): RoleDefinition {
    return {
      id: role.id,
      organization_id: role.organization_id,
      key: role.key,
      name: role.name,
      description: role.description,
      kind: role.kind,
      is_assignable: role.is_assignable,
      created_by: role.created_by,
      created_at: role.created_at.toISOString(),
      updated_at: role.updated_at.toISOString(),
    };
  }

  private assertMutable(role: Role): void {
    if (role.kind === RoleKind.SYSTEM) {
      throw new BadRequestException('System roles cannot be modified');
    }
  }

  private async assertActorManagesRole(actorId: number, role: Role): Promise<void> {
    if (!role.organization_id) {
      throw new ForbiddenException('Only platform admins can manage system roles');
    }
    const effective = await this.authz.effectivePermissions(
      actorId,
      role.organization_id,
    );
    if (
      !effective.permissions.includes('*') &&
      !effective.permissions.includes('roles:manage')
    ) {
      throw new ForbiddenException('Missing roles:manage permission');
    }
  }

  private async assertActorCanGrant(
    actorId: number,
    organizationId: string,
    permissionKeys: string[],
  ): Promise<void> {
    if (!permissionKeys.length) return;
    const effective = await this.authz.effectivePermissions(actorId, organizationId);
    if (effective.permissions.includes('*')) return;
    if (permissionKeys.includes('*')) {
      throw new ForbiddenException('Only a super admin can grant the wildcard');
    }
    const missing = [...new Set(permissionKeys)].filter(
      (key) => !effective.permissions.includes(key),
    );
    if (missing.length) {
      throw new ForbiddenException(
        `Cannot grant permissions you do not hold: ${missing.join(', ')}`,
      );
    }
  }

  private async resolveGroupIds(
    groupIds: string[],
    organizationId: string | null,
  ): Promise<string[]> {
    if (!groupIds.length) return [];
    const rows = await this.groups.find({ where: { id: In(groupIds) } });
    if (rows.length !== new Set(groupIds).size) {
      const found = new Set(rows.map((r) => r.id));
      throw new BadRequestException(
        `Unknown permission groups: ${groupIds.filter((id) => !found.has(id)).join(', ')}`,
      );
    }
    const invalid = rows.filter(
      (g) => g.organization_id && g.organization_id !== organizationId,
    );
    if (invalid.length) {
      throw new BadRequestException('Permission group belongs to another organization');
    }
    return rows.map((r) => r.id);
  }

  private async groupPermissionKeys(groupIds: string[]): Promise<string[]> {
    if (!groupIds.length) return [];
    const items = await this.groupItems.find({
      where: { group_id: In(groupIds) },
    });
    return items.map((i) => i.permission_key);
  }

  /** Used by the seeder: create/update the platform system roles. */
  async seedSystemRoles(): Promise<void> {
    for (const definition of SYSTEM_ROLES) {
      let role = await this.roles.findOne({
        where: { key: definition.key, organization_id: IsNull() },
      });
      if (!role) {
        role = await this.roles.save(
          this.roles.create({
            organization_id: null,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            kind: RoleKind.SYSTEM,
            is_assignable: true,
            created_by: null,
          }),
        );
      } else {
        role.name = definition.name;
        role.description = definition.description;
        role.kind = RoleKind.SYSTEM;
        role.is_assignable = true;
        role = await this.roles.save(role);
      }

      await this.rolePermissions.delete({ role_id: role.id });
      if (definition.permissions.length) {
        await this.rolePermissions.save(
          definition.permissions.map((key) =>
            this.rolePermissions.create({
              role_id: role.id,
              permission_key: key,
            }),
          ),
        );
      }
    }
    this.authz.invalidate();
  }

  isSystemOwnerRole(role: Role): boolean {
    return (
      role.key === SystemRoleKey.ORG_OWNER &&
      role.organization_id !== null
    );
  }
}
