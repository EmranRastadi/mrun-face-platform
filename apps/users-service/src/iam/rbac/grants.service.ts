import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GrantEffect,
  GrantSubjectType,
  ScopeType,
  type ResourceGrant as ResourceGrantContract,
} from '@mrun/contracts';
import { ResourceGrant } from '../entities/resource-grant.entity';
import { ResourceRegistryEntry } from '../entities/resource-registry.entity';
import { Organization } from '../entities/organization.entity';
import { OrgUnit } from '../entities/org-unit.entity';
import { User } from '../../users/users.entity';
import { CreateGrantDto } from '../dto/iam.dto';
import { AuthzService } from '../authz/authz.service';
import { PermissionsService } from './permissions.service';

@Injectable()
export class GrantsService {
  constructor(
    @InjectRepository(ResourceGrant)
    private readonly grants: Repository<ResourceGrant>,
    @InjectRepository(ResourceRegistryEntry)
    private readonly registry: Repository<ResourceRegistryEntry>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrgUnit)
    private readonly orgUnits: Repository<OrgUnit>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly permissionsService: PermissionsService,
    private readonly authz: AuthzService,
  ) {}

  async list(filters: {
    organizationId?: string;
    resourceType?: string;
    resourceId?: string;
  }): Promise<ResourceGrantContract[]> {
    const where: Record<string, unknown> = {};
    if (filters.organizationId) where.organization_id = filters.organizationId;
    if (filters.resourceType) where.resource_type = filters.resourceType;
    if (filters.resourceId) where.resource_id = filters.resourceId;
    const rows = await this.grants.find({
      where: where as never,
      order: { created_at: 'DESC' },
      take: 500,
    });
    return rows.map((row) => this.toContract(row));
  }

  async create(dto: CreateGrantDto, actorId: number): Promise<ResourceGrantContract> {
    const organization = await this.organizations.findOne({
      where: { id: dto.organizationId },
    });
    if (!organization) {
      throw new NotFoundException(`Organization ${dto.organizationId} not found`);
    }
    await this.permissionsService.assertExist([dto.permissionKey]);

    const resource = await this.registry.findOne({
      where: { resource_id: dto.resourceId },
    });
    if (resource && resource.organization_id !== dto.organizationId) {
      throw new BadRequestException('Resource belongs to another organization');
    }

    if (dto.subjectType === GrantSubjectType.USER) {
      const userId = Number(dto.subjectId);
      const user = Number.isInteger(userId)
        ? await this.users.findOne({ where: { id: userId } })
        : null;
      if (!user) throw new BadRequestException('Grant subject user not found');
    } else if (dto.subjectType === GrantSubjectType.ORG_UNIT) {
      const unit = await this.orgUnits.findOne({ where: { id: dto.subjectId } });
      if (!unit || unit.organization_id !== dto.organizationId) {
        throw new BadRequestException('Grant subject unit not found in organization');
      }
    }

    const decision = await this.authz.check(actorId, {
      permission: dto.permissionKey,
      organizationId: dto.organizationId,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      scopeType: dto.resourceType === 'robot' ? null : ScopeType.ORGANIZATION,
    });
    if (!decision.allowed) {
      throw new ForbiddenException(
        `Cannot grant a permission you do not hold: ${dto.permissionKey}`,
      );
    }

    const grant = await this.grants.save(
      this.grants.create({
        organization_id: dto.organizationId,
        resource_type: dto.resourceType,
        resource_id: dto.resourceId,
        subject_type: dto.subjectType,
        subject_id: dto.subjectId,
        permission_key: dto.permissionKey,
        effect: dto.effect ?? GrantEffect.ALLOW,
        granted_by: actorId,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
    this.authz.invalidate();
    return this.toContract(grant);
  }

  async remove(id: string, actorId: number): Promise<void> {
    const grant = await this.grants.findOne({ where: { id } });
    if (!grant) throw new NotFoundException(`Grant ${id} not found`);

    const actor = await this.authz.effectivePermissions(
      actorId,
      grant.organization_id,
    );
    if (!actor.permissions.includes('*') && !actor.permissions.includes('roles:manage')) {
      throw new ForbiddenException('Missing roles:manage permission');
    }
    await this.grants.delete(id);
    this.authz.invalidate();
  }

  private toContract(row: ResourceGrant): ResourceGrantContract {
    return {
      id: row.id,
      organization_id: row.organization_id,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      permission_key: row.permission_key,
      effect: row.effect,
      granted_by: row.granted_by,
      expires_at: row.expires_at ? row.expires_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
    };
  }
}
