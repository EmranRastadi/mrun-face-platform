import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { OrgUnit } from '../entities/org-unit.entity';
import { OrgUnitMember } from '../entities/org-unit-member.entity';
import { Organization } from '../entities/organization.entity';
import { CreateOrgUnitDto, UpdateOrgUnitDto } from '../dto/iam.dto';

@Injectable()
export class OrgUnitsService {
  constructor(
    @InjectRepository(OrgUnit)
    private readonly units: Repository<OrgUnit>,
    @InjectRepository(OrgUnitMember)
    private readonly members: Repository<OrgUnitMember>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  list(organizationId: string, kind?: string): Promise<OrgUnit[]> {
    return this.units.find({
      where: kind ? { organization_id: organizationId, kind: kind as never } : { organization_id: organizationId },
      order: { path: 'ASC' },
    });
  }

  async get(id: string): Promise<OrgUnit> {
    const unit = await this.units.findOne({ where: { id } });
    if (!unit) throw new NotFoundException(`Org unit ${id} not found`);
    return unit;
  }

  async create(organizationId: string, dto: CreateOrgUnitDto): Promise<OrgUnit> {
    const organization = await this.organizations.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    let parent: OrgUnit | null = null;
    if (dto.parent_id) {
      parent = await this.units.findOne({ where: { id: dto.parent_id } });
      if (!parent) throw new BadRequestException('Parent unit not found');
      if (parent.organization_id !== organizationId) {
        throw new BadRequestException('Parent unit belongs to another organization');
      }
    }

    const duplicate = await this.units.findOne({
      where: { organization_id: organizationId, name: dto.name },
    });
    if (duplicate) {
      throw new ConflictException('A unit with this name already exists');
    }

    const unit = this.units.create({
      organization_id: organizationId,
      parent_id: parent?.id ?? null,
      kind: dto.kind,
      name: dto.name,
      code: dto.code ?? null,
      manager_user_id: dto.manager_user_id ?? null,
      depth: parent ? parent.depth + 1 : 0,
      path: '',
    });
    unit.path = parent ? `${parent.path}/${unit.id}` : `/${unit.id}`;
    return this.units.save(unit);
  }

  async update(id: string, dto: UpdateOrgUnitDto): Promise<OrgUnit> {
    const unit = await this.get(id);
    if (dto.name !== undefined) unit.name = dto.name;
    if (dto.code !== undefined) unit.code = dto.code;
    if (dto.manager_user_id !== undefined) unit.manager_user_id = dto.manager_user_id;
    if (dto.status !== undefined) unit.status = dto.status;
    return this.units.save(unit);
  }

  async remove(id: string): Promise<void> {
    const unit = await this.get(id);
    const children = await this.units.count({ where: { parent_id: unit.id } });
    if (children > 0) {
      throw new ConflictException('Remove child units first');
    }
    const members = await this.members.count({ where: { org_unit_id: unit.id } });
    if (members > 0) {
      throw new ConflictException('Remove unit members first');
    }
    await this.units.delete(unit.id);
  }

  listMembers(unitId: string): Promise<OrgUnitMember[]> {
    return this.members.find({
      where: { org_unit_id: unitId, left_at: IsNull() },
      order: { joined_at: 'ASC' },
    });
  }

  async addMember(
    unitId: string,
    userId: number,
    isLead = false,
  ): Promise<OrgUnitMember> {
    await this.get(unitId);
    const existing = await this.members.findOne({
      where: { org_unit_id: unitId, user_id: userId },
    });
    if (existing) {
      if (existing.left_at) {
        existing.left_at = null;
        existing.is_lead = isLead;
        return this.members.save(existing);
      }
      throw new ConflictException('User is already a member of this unit');
    }
    return this.members.save(
      this.members.create({
        org_unit_id: unitId,
        user_id: userId,
        is_lead: isLead,
      }),
    );
  }

  async removeMember(unitId: string, userId: number): Promise<void> {
    const member = await this.members.findOne({
      where: { org_unit_id: unitId, user_id: userId },
    });
    if (!member) throw new NotFoundException('Unit member not found');
    member.left_at = new Date();
    await this.members.save(member);
  }
}
