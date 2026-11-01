import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MembershipStatus,
  OrganizationKind,
  OrganizationStatus,
  ScopeType,
} from '@mrun/contracts';
import { Organization } from '../entities/organization.entity';
import { OrgMembership } from '../entities/org-membership.entity';
import { User } from '../../users/users.entity';
import { AddMemberDto, CreateOrganizationDto, UpdateMemberDto, UpdateOrganizationDto } from '../dto/iam.dto';
import { AuthzService } from '../authz/authz.service';
import { AssignmentsService } from '../rbac/assignments.service';
import { RolesService } from '../rbac/roles.service';
import { SystemRoleKey } from '../constants/system-roles';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(OrgMembership)
    private readonly memberships: Repository<OrgMembership>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly authz: AuthzService,
    private readonly assignments: AssignmentsService,
    private readonly roles: RolesService,
  ) {}

  async listForUser(userId: number): Promise<Organization[]> {
    const context = await this.authz.tokenContext(userId);
    if (context.platformStaff) {
      return this.organizations.find({ order: { name: 'ASC' } });
    }
    const memberships = await this.memberships.find({
      where: { user_id: userId, status: MembershipStatus.ACTIVE },
    });
    if (!memberships.length) return [];
    return this.organizations
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids: memberships.map((m) => m.organization_id) })
      .orderBy('o.name', 'ASC')
      .getMany();
  }

  async get(id: string, userId: number): Promise<Organization> {
    const organization = await this.getEntity(id);
    const context = await this.authz.tokenContext(userId);
    if (context.platformStaff) return organization;
    const membership = await this.memberships.findOne({
      where: {
        organization_id: id,
        user_id: userId,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return organization;
  }

  async getEntity(id: string): Promise<Organization> {
    const organization = await this.organizations.findOne({ where: { id } });
    if (!organization) throw new NotFoundException(`Organization ${id} not found`);
    return organization;
  }

  async create(dto: CreateOrganizationDto, actorId: number): Promise<Organization> {
    const existing = await this.organizations.findOne({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is taken`);

    if (dto.parent_id) {
      const parent = await this.organizations.findOne({ where: { id: dto.parent_id } });
      if (!parent) throw new BadRequestException('Parent organization not found');
      if (parent.kind !== OrganizationKind.PLATFORM) {
        throw new BadRequestException('Only the platform organization can have child organizations');
      }
    }

    if (dto.kind === OrganizationKind.PLATFORM) {
      const platform = await this.organizations.findOne({
        where: { kind: OrganizationKind.PLATFORM },
      });
      if (platform) throw new ConflictException('A platform organization already exists');
    }

    const organization = await this.organizations.save(
      this.organizations.create({
        kind: dto.kind,
        slug: dto.slug,
        name: dto.name,
        parent_id: dto.parent_id ?? null,
        status: OrganizationStatus.ACTIVE,
        timezone: dto.timezone ?? 'UTC',
        metadata: dto.metadata ?? null,
      }),
    );

    const context = await this.authz.tokenContext(actorId);
    if (!context.platformStaff) {
      await this.memberships.save(
        this.memberships.create({
          organization_id: organization.id,
          user_id: actorId,
          status: MembershipStatus.ACTIVE,
          is_primary: true,
        }),
      );
      const ownerRole = await this.roles.findByKey(SystemRoleKey.ORG_OWNER);
      if (ownerRole) {
        await this.assignments.assign(
          {
            userId: actorId,
            roleId: ownerRole.id,
            organizationId: organization.id,
            scopeType: ScopeType.ORGANIZATION,
          },
          actorId,
        );
      }
    }

    return organization;
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    const organization = await this.getEntity(id);
    if (dto.name !== undefined) organization.name = dto.name;
    if (dto.status !== undefined) organization.status = dto.status;
    if (dto.timezone !== undefined) organization.timezone = dto.timezone;
    if (dto.metadata !== undefined) organization.metadata = dto.metadata;
    await this.organizations.save(organization);
    return organization;
  }

  async listMembers(id: string): Promise<
    Array<{ membership: OrgMembership; user: Pick<User, 'id' | 'username' | 'email' | 'full_name'> | null }>
  > {
    const rows = await this.memberships.find({
      where: { organization_id: id },
      order: { joined_at: 'ASC' },
    });
    const users = rows.length
      ? await this.users.find({ where: rows.map((r) => ({ id: r.user_id })) })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((membership) => {
      const user = byId.get(membership.user_id);
      return {
        membership,
        user: user
          ? {
              id: user.id,
              username: user.username,
              email: user.email,
              full_name: user.full_name,
            }
          : null,
      };
    });
  }

  async addMember(
    organizationId: string,
    dto: AddMemberDto,
    actorId: number,
  ): Promise<OrgMembership> {
    await this.getEntity(organizationId);

    let user: User | null = null;
    if (dto.userId) {
      user = await this.users.findOne({ where: { id: dto.userId } });
    } else if (dto.username) {
      user = await this.users.findOne({ where: { username: dto.username } });
    } else if (dto.email) {
      user = await this.users.findOne({ where: { email: dto.email } });
    }
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.memberships.findOne({
      where: { organization_id: organizationId, user_id: user.id },
    });
    if (existing) {
      if (existing.status === MembershipStatus.REMOVED) {
        existing.status = MembershipStatus.ACTIVE;
        existing.left_at = null;
        return this.memberships.save(existing);
      }
      throw new ConflictException('User is already a member');
    }

    const hasPrimary = await this.memberships.findOne({
      where: { organization_id: organizationId, is_primary: true },
    });

    const membership = await this.memberships.save(
      this.memberships.create({
        organization_id: organizationId,
        user_id: user.id,
        status: MembershipStatus.ACTIVE,
        title: dto.title ?? null,
        employee_no: dto.employee_no ?? null,
        is_primary: dto.is_primary ?? !hasPrimary,
      }),
    );

    await this.authz.bumpPermissionVersion(user.id);
    void actorId;
    return membership;
  }

  async updateMember(
    organizationId: string,
    userId: number,
    dto: UpdateMemberDto,
  ): Promise<OrgMembership> {
    const membership = await this.memberships.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    if (dto.status !== undefined) {
      membership.status = dto.status;
      if (dto.status === MembershipStatus.REMOVED) membership.left_at = new Date();
    }
    if (dto.title !== undefined) membership.title = dto.title;
    if (dto.employee_no !== undefined) membership.employee_no = dto.employee_no;
    if (dto.is_primary !== undefined) membership.is_primary = dto.is_primary;
    await this.memberships.save(membership);
    await this.authz.bumpPermissionVersion(userId);
    return membership;
  }

  async removeMember(organizationId: string, userId: number): Promise<void> {
    const membership = await this.memberships.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    membership.status = MembershipStatus.REMOVED;
    membership.left_at = new Date();
    membership.is_primary = false;
    await this.memberships.save(membership);
    await this.authz.bumpPermissionVersion(userId);
  }
}
