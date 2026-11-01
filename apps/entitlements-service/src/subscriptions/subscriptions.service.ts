import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, MoreThan, Repository } from 'typeorm';
import {
  SubscriptionStatus,
  type OrganizationSubscription as OrganizationSubscriptionContract,
  type RobotSubscription as RobotSubscriptionContract,
} from '@mrun/contracts';
import { OrganizationSubscription } from './organization-subscription.entity';
import { RobotSubscription } from './robot-subscription.entity';
import { PlansService } from '../plans/plans.service';
import { AuditService } from '../entitlements/audit.service';
import {
  CreateOrganizationSubscriptionDto,
  CreateRobotSubscriptionDto,
  UpdateOrganizationSubscriptionDto,
} from '../dto/entitlements.dto';

/** Statuses that grant entitlements right now. */
export const LIVE_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(OrganizationSubscription)
    private readonly orgSubscriptions: Repository<OrganizationSubscription>,
    @InjectRepository(RobotSubscription)
    private readonly robotSubscriptions: Repository<RobotSubscription>,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
  ) {}

  async listOrganizationSubscriptions(filters: {
    organizationId?: string;
    status?: SubscriptionStatus;
  }): Promise<OrganizationSubscriptionContract[]> {
    const where: FindOptionsWhere<OrganizationSubscription> = {};
    if (filters.organizationId) where.organization_id = filters.organizationId;
    if (filters.status) where.status = filters.status;
    const rows = await this.orgSubscriptions.find({
      where,
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.toContract(row));
  }

  async getOrganizationSubscription(
    id: string,
  ): Promise<OrganizationSubscriptionContract> {
    return this.toContract(await this.getOrganizationEntity(id));
  }

  async getOrganizationEntity(id: string): Promise<OrganizationSubscription> {
    const row = await this.orgSubscriptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Organization subscription ${id} not found`);
    }
    return row;
  }

  async createOrganizationSubscription(
    dto: CreateOrganizationSubscriptionDto,
    actorId: number,
  ): Promise<OrganizationSubscriptionContract> {
    const plan = await this.plans.getEntity(dto.planId);
    await this.plans.assertAssignable(plan);

    const existing = await this.orgSubscriptions.findOne({
      where: {
        organization_id: dto.organizationId,
        status: In(LIVE_SUBSCRIPTION_STATUSES),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Organization already has a live subscription; update or cancel it first',
      );
    }

    const row = await this.orgSubscriptions.save(
      this.orgSubscriptions.create({
        organization_id: dto.organizationId,
        plan_id: plan.id,
        status: dto.status ?? SubscriptionStatus.ACTIVE,
        seats: dto.seats ?? null,
        starts_at: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        ends_at: dto.endsAt ? new Date(dto.endsAt) : null,
        trial_ends_at: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
        external_ref: dto.externalRef ?? null,
        created_by: actorId,
        metadata: dto.metadata ?? null,
      }),
    );

    await this.audit.record({
      entityType: 'organization_subscription',
      entityId: row.id,
      action: 'created',
      actorId,
      after: this.toContract(row) as unknown as Record<string, unknown>,
    });
    return this.toContract(row);
  }

  async updateOrganizationSubscription(
    id: string,
    dto: UpdateOrganizationSubscriptionDto,
    actorId: number,
  ): Promise<OrganizationSubscriptionContract> {
    const row = await this.getOrganizationEntity(id);
    const before = this.toContract(row);

    if (dto.planId !== undefined && dto.planId !== row.plan_id) {
      const plan = await this.plans.getEntity(dto.planId);
      await this.plans.assertAssignable(plan);
      row.plan_id = plan.id;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
      if (dto.status === SubscriptionStatus.CANCELED) {
        row.canceled_at = row.canceled_at ?? new Date();
      }
    }
    if (dto.seats !== undefined) row.seats = dto.seats;
    if (dto.endsAt !== undefined) {
      row.ends_at = dto.endsAt ? new Date(dto.endsAt) : null;
    }
    if (dto.trialEndsAt !== undefined) {
      row.trial_ends_at = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;
    }
    if (dto.externalRef !== undefined) row.external_ref = dto.externalRef;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;

    const saved = await this.orgSubscriptions.save(row);
    await this.audit.record({
      entityType: 'organization_subscription',
      entityId: saved.id,
      action: 'updated',
      actorId,
      before: before as unknown as Record<string, unknown>,
      after: this.toContract(saved) as unknown as Record<string, unknown>,
    });
    return this.toContract(saved);
  }

  async cancelOrganizationSubscription(
    id: string,
    actorId: number,
  ): Promise<OrganizationSubscriptionContract> {
    const row = await this.getOrganizationEntity(id);
    if (row.status === SubscriptionStatus.CANCELED) {
      return this.toContract(row);
    }
    row.status = SubscriptionStatus.CANCELED;
    row.canceled_at = new Date();
    const saved = await this.orgSubscriptions.save(row);
    await this.audit.record({
      entityType: 'organization_subscription',
      entityId: saved.id,
      action: 'canceled',
      actorId,
      after: { canceled_at: saved.canceled_at },
    });
    return this.toContract(saved);
  }

  /** Finds the subscription that currently governs an organization. */
  async findLiveOrganizationSubscription(
    organizationId: string,
  ): Promise<OrganizationSubscription | null> {
    const now = new Date();
    const rows = await this.orgSubscriptions.find({
      where: {
        organization_id: organizationId,
        status: In(LIVE_SUBSCRIPTION_STATUSES),
        starts_at: undefined,
      },
      order: { created_at: 'DESC' },
      take: 5,
    });
    return (
      rows.find(
        (row) =>
          (!row.ends_at || row.ends_at > now) &&
          (!row.trial_ends_at ||
            row.status === SubscriptionStatus.ACTIVE ||
            row.trial_ends_at > now),
      ) ?? null
    );
  }

  async listRobotSubscriptions(filters: {
    organizationId?: string;
    robotId?: string;
    status?: SubscriptionStatus;
  }): Promise<RobotSubscriptionContract[]> {
    const where: FindOptionsWhere<RobotSubscription> = {};
    if (filters.organizationId) where.organization_id = filters.organizationId;
    if (filters.robotId) where.robot_id = filters.robotId;
    if (filters.status) where.status = filters.status;
    const rows = await this.robotSubscriptions.find({
      where,
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.toRobotContract(row));
  }

  async getRobotSubscription(id: string): Promise<RobotSubscriptionContract> {
    return this.toRobotContract(await this.getRobotEntity(id));
  }

  async getRobotEntity(id: string): Promise<RobotSubscription> {
    const row = await this.robotSubscriptions.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Robot subscription ${id} not found`);
    }
    return row;
  }

  async createRobotSubscription(
    dto: CreateRobotSubscriptionDto,
    actorId: number,
  ): Promise<RobotSubscriptionContract> {
    const plan = await this.plans.getEntity(dto.planId);
    await this.plans.assertAssignable(plan);

    const existing = await this.robotSubscriptions.findOne({
      where: {
        robot_id: dto.robotId,
        status: In(LIVE_SUBSCRIPTION_STATUSES),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Robot already has a live subscription; cancel it first',
      );
    }

    const row = await this.robotSubscriptions.save(
      this.robotSubscriptions.create({
        organization_id: dto.organizationId,
        robot_id: dto.robotId,
        plan_id: plan.id,
        status: dto.status ?? SubscriptionStatus.ACTIVE,
        starts_at: dto.startsAt ? new Date(dto.startsAt) : new Date(),
        ends_at: dto.endsAt ? new Date(dto.endsAt) : null,
        created_by: actorId,
        metadata: dto.metadata ?? null,
      }),
    );

    await this.audit.record({
      entityType: 'robot_subscription',
      entityId: row.id,
      action: 'created',
      actorId,
      after: this.toRobotContract(row) as unknown as Record<string, unknown>,
    });
    return this.toRobotContract(row);
  }

  async cancelRobotSubscription(
    id: string,
    actorId: number,
  ): Promise<RobotSubscriptionContract> {
    const row = await this.getRobotEntity(id);
    if (row.status === SubscriptionStatus.CANCELED) {
      return this.toRobotContract(row);
    }
    row.status = SubscriptionStatus.CANCELED;
    row.canceled_at = new Date();
    const saved = await this.robotSubscriptions.save(row);
    await this.audit.record({
      entityType: 'robot_subscription',
      entityId: saved.id,
      action: 'canceled',
      actorId,
      after: { canceled_at: saved.canceled_at },
    });
    return this.toRobotContract(saved);
  }

  /** Finds the subscription that currently governs a robot. */
  async findLiveRobotSubscription(
    robotId: string,
  ): Promise<RobotSubscription | null> {
    const rows = await this.robotSubscriptions.find({
      where: {
        robot_id: robotId,
        status: In(LIVE_SUBSCRIPTION_STATUSES),
      },
      order: { created_at: 'DESC' },
      take: 5,
    });
    const now = new Date();
    return (
      rows.find((row) => !row.ends_at || row.ends_at > now) ?? null
    );
  }

  private toContract(
    row: OrganizationSubscription,
  ): OrganizationSubscriptionContract {
    return {
      id: row.id,
      organization_id: row.organization_id,
      plan_id: row.plan_id,
      status: row.status,
      seats: row.seats,
      starts_at: row.starts_at.toISOString(),
      ends_at: row.ends_at ? row.ends_at.toISOString() : null,
      trial_ends_at: row.trial_ends_at ? row.trial_ends_at.toISOString() : null,
      canceled_at: row.canceled_at ? row.canceled_at.toISOString() : null,
      external_ref: row.external_ref,
      created_by: row.created_by,
      metadata: row.metadata,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private toRobotContract(row: RobotSubscription): RobotSubscriptionContract {
    return {
      id: row.id,
      organization_id: row.organization_id,
      robot_id: row.robot_id,
      plan_id: row.plan_id,
      status: row.status,
      starts_at: row.starts_at.toISOString(),
      ends_at: row.ends_at ? row.ends_at.toISOString() : null,
      canceled_at: row.canceled_at ? row.canceled_at.toISOString() : null,
      created_by: row.created_by,
      metadata: row.metadata,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }
}
