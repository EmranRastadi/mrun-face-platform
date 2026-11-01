import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PermissionTier, type PermissionDefinition } from '@mrun/contracts';
import { Permission } from '../entities/permission.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { PermissionGroupItem } from '../entities/permission-group-item.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissions: Repository<Permission>,
    @InjectRepository(PermissionGroup)
    private readonly groups: Repository<PermissionGroup>,
    @InjectRepository(PermissionGroupItem)
    private readonly groupItems: Repository<PermissionGroupItem>,
  ) {}

  list(tier?: PermissionTier): Promise<Permission[]> {
    return this.permissions.find({
      where: tier ? { tier } : {},
      order: { resource: 'ASC', action: 'ASC' },
    });
  }

  listGroups(organizationId?: string | null): Promise<PermissionGroup[]> {
    return this.groups.find({
      where: organizationId
        ? [{ organization_id: organizationId }, { organization_id: IsNull() }]
        : {},
      order: { key: 'ASC' },
    });
  }

  async getGroupItems(groupIds: string[]): Promise<PermissionGroupItem[]> {
    if (!groupIds.length) return [];
    return this.groupItems.find({ where: { group_id: In(groupIds) } });
  }

  async assertExist(keys: string[]): Promise<PermissionDefinition[]> {
    const unique = [...new Set(keys)];
    if (!unique.length) return [];
    const rows = await this.permissions.find({ where: { key: In(unique) } });
    const found = new Set(rows.map((r) => r.key));
    const missing = unique.filter((k) => !found.has(k));
    if (missing.length) {
      throw new BadRequestException(`Unknown permissions: ${missing.join(', ')}`);
    }
    return rows as unknown as PermissionDefinition[];
  }

  /** Tenant-owned roles may only include `tenant` tier permissions. */
  async assertTenantGrantable(keys: string[]): Promise<void> {
    const rows = await this.assertExist(keys);
    const forbidden = rows.filter((r) => r.tier !== PermissionTier.TENANT);
    if (forbidden.length) {
      throw new BadRequestException(
        `Tenant roles cannot include platform permissions: ${forbidden
          .map((r) => r.key)
          .join(', ')}`,
      );
    }
  }

  async getGroupById(id: string): Promise<PermissionGroup> {
    const group = await this.groups.findOne({ where: { id } });
    if (!group) throw new NotFoundException(`Permission group ${id} not found`);
    return group;
  }
}
