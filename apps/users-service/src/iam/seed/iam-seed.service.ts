import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  AssignmentStatus,
  OrganizationKind,
  OrganizationStatus,
  Role as LegacyRole,
  ScopeType,
} from '@mrun/contracts';
import { Organization } from '../entities/organization.entity';
import { Permission } from '../entities/permission.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { PermissionGroupItem } from '../entities/permission-group-item.entity';
import { Role } from '../entities/role.entity';
import { RoleAssignment } from '../entities/role-assignment.entity';
import { User } from '../../users/users.entity';
import { UsersService } from '../../users/users.service';
import { RolesService } from '../rbac/roles.service';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
} from '../constants/permissions.catalog';
import {
  SystemRoleKey,
  validateSystemRoleCatalog,
} from '../constants/system-roles';

export const PLATFORM_ORG_SLUG = 'mrun-platform';

@Injectable()
export class IamSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IamSeedService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(PermissionGroup)
    private readonly groups: Repository<PermissionGroup>,
    @InjectRepository(PermissionGroupItem)
    private readonly groupItems: Repository<PermissionGroupItem>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(RoleAssignment)
    private readonly assignments: Repository<RoleAssignment>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      validateSystemRoleCatalog();
      const platform = await this.ensurePlatformOrganization();
      await this.seedPermissions();
      await this.seedPermissionGroups();
      await this.rolesService.seedSystemRoles();
      await this.ensureBootstrapAdministrator(platform);
      this.logger.log('IAM catalog, system roles and bootstrap admin are ready');
    } catch (error) {
      this.logger.error(
        `IAM seed failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getPlatformOrganization(): Promise<Organization> {
    return this.ensurePlatformOrganization();
  }

  private async ensurePlatformOrganization(): Promise<Organization> {
    let platform = await this.organizations.findOne({
      where: { kind: OrganizationKind.PLATFORM },
    });
    if (platform) return platform;

    const slug =
      this.config.get<string>('PLATFORM_ORG_SLUG') ?? PLATFORM_ORG_SLUG;
    platform = await this.organizations.findOne({ where: { slug } });
    if (platform) {
      platform.kind = OrganizationKind.PLATFORM;
      platform.status = OrganizationStatus.ACTIVE;
      return this.organizations.save(platform);
    }

    return this.organizations.save(
      this.organizations.create({
        kind: OrganizationKind.PLATFORM,
        slug,
        name: this.config.get<string>('PLATFORM_ORG_NAME', 'MRUN Platform'),
        parent_id: null,
        status: OrganizationStatus.ACTIVE,
        timezone: 'UTC',
        metadata: { seeded: true },
      }),
    );
  }

  private async seedPermissions(): Promise<void> {
    const existing = await this.permissions.find();
    const byKey = new Map(existing.map((row) => [row.key, row]));
    const toSave: Permission[] = [];

    for (const definition of PERMISSION_CATALOG) {
      const row = byKey.get(definition.key);
      if (row) {
        row.resource = definition.resource;
        row.action = definition.action;
        row.description = definition.description;
        row.tier = definition.tier;
        row.is_system = true;
        toSave.push(row);
      } else {
        toSave.push(this.permissions.create({ ...definition }));
      }
    }
    if (toSave.length) await this.permissions.save(toSave);
  }

  private async seedPermissionGroups(): Promise<void> {
    for (const definition of PERMISSION_GROUPS) {
      let group = await this.groups.findOne({
        where: { key: definition.key, organization_id: IsNull() },
      });
      if (group) {
        group.name = definition.name;
        group.description = definition.description;
        group.is_system = true;
        group = await this.groups.save(group);
      } else {
        group = await this.groups.save(
          this.groups.create({
            organization_id: null,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            is_system: true,
          }),
        );
      }

      await this.groupItems.delete({ group_id: group.id });
      if (definition.permissions.length) {
        await this.groupItems.save(
          definition.permissions.map((permission_key) =>
            this.groupItems.create({ group_id: group.id, permission_key }),
          ),
        );
      }
    }
  }

  private async ensureBootstrapAdministrator(
    platform: Organization,
  ): Promise<void> {
    const username = this.config.get<string>('BOOTSTRAP_ADMIN_USERNAME');
    const password = this.config.get<string>('BOOTSTRAP_ADMIN_PASSWORD');

    let administrator: User | null = null;
    if (username) {
      administrator = await this.usersService.findByUsername(username);
    }

    if (!administrator && password && username) {
      const hasAdmin = await this.usersService.hasAdmin();
      if (!hasAdmin) {
        administrator = await this.usersService.create(
          {
            username,
            email: this.config.get<string>(
              'BOOTSTRAP_ADMIN_EMAIL',
              `${username}@mrun.local`,
            ),
            password,
            full_name: 'Bootstrap Admin',
          },
          LegacyRole.ADMIN,
        );
      }
    }

    // Map every legacy admin to the platform super-admin role.
    const allUsers = await this.usersService.findAll();
    const legacyAdmins = allUsers.filter(
      (user) => user.role === LegacyRole.ADMIN,
    );
    const targets = new Map<number, User>();
    for (const admin of legacyAdmins) targets.set(admin.id, admin);
    if (administrator) targets.set(administrator.id, administrator);

    for (const admin of targets.values()) {
      await this.ensureSuperAdmin(admin.id, platform);
    }
  }

  private async ensureSuperAdmin(
    userId: number,
    platform: Organization,
  ): Promise<void> {
    const role = await this.rolesService.findByKey(SystemRoleKey.SUPER_ADMIN);
    if (!role) {
      throw new Error('super_admin role is missing after seeding');
    }

    const existing = await this.assignments.findOne({
      where: {
        user_id: userId,
        role_id: role.id,
        scope_type: ScopeType.PLATFORM,
        status: AssignmentStatus.ACTIVE,
      },
    });
    if (existing) return;

    await this.assignments.save(
      this.assignments.create({
        user_id: userId,
        role_id: role.id,
        organization_id: platform.id,
        scope_type: ScopeType.PLATFORM,
        scope_id: null,
        status: AssignmentStatus.ACTIVE,
        granted_by: null,
        reason: 'bootstrap',
      }),
    );
  }
}
