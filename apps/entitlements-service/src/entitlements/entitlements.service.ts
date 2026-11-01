import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  IsNull,
  Repository,
} from 'typeorm';
import {
  EntitlementDenyReason,
  EntitlementSource,
  PlanStatus,
  SubscriptionStatus,
  type EntitlementCheckResult,
  type EntitlementOverride as EntitlementOverrideContract,
  type EntitlementSnapshot,
  type UsageSnapshot,
} from '@mrun/contracts';
import { EntitlementOverride } from './entitlement-override.entity';
import { UsageCounter } from './usage-counter.entity';
import { UsageConsumption } from './usage-consumption.entity';
import { Plan } from '../plans/plan.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PlansService } from '../plans/plans.service';
import { FeaturesService } from '../features/features.service';
import { AuditService } from './audit.service';
import {
  ConsumeEntitlementDto,
  CreateEntitlementOverrideDto,
  EntitlementCheckDto,
} from '../dto/entitlements.dto';

interface Candidate {
  source: EntitlementSource;
  planId: string;
  subscriptionId: string | null;
}

export interface ConsumeResult extends EntitlementCheckResult {
  duplicate: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EntitlementsService {
  constructor(
    @InjectRepository(EntitlementOverride)
    private readonly overrides: Repository<EntitlementOverride>,
    @InjectRepository(UsageCounter)
    private readonly counters: Repository<UsageCounter>,
    @InjectRepository(UsageConsumption)
    private readonly consumptions: Repository<UsageConsumption>,
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
    private readonly subscriptions: SubscriptionsService,
    private readonly plansService: PlansService,
    private readonly features: FeaturesService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- overrides

  async listOverrides(filters: {
    organizationId?: string;
    featureKey?: string;
    robotId?: string;
    includeRevoked?: boolean;
  }): Promise<EntitlementOverrideContract[]> {
    const where: FindOptionsWhere<EntitlementOverride> = {};
    if (filters.organizationId) where.organization_id = filters.organizationId;
    if (filters.featureKey) where.feature_key = filters.featureKey;
    if (filters.robotId) where.robot_id = filters.robotId;
    if (!filters.includeRevoked) where.revoked_at = IsNull();

    const rows = await this.overrides.find({
      where,
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.toOverrideContract(row));
  }

  async createOverride(
    dto: CreateEntitlementOverrideDto,
    actorId: number,
  ): Promise<EntitlementOverrideContract> {
    await this.features.get(dto.featureKey);

    if (dto.expiresAt && new Date(dto.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    const row = await this.overrides.save(
      this.overrides.create({
        organization_id: dto.organizationId,
        robot_id: dto.robotId ?? null,
        feature_key: dto.featureKey,
        enabled: dto.enabled,
        limit_value:
          dto.limitValue === undefined || dto.limitValue === null
            ? null
            : String(dto.limitValue),
        reason: dto.reason,
        granted_by: actorId,
        expires_at: dto.expiresAt ? new Date(dto.expiresAt) : null,
        revoked_at: null,
      }),
    );

    await this.audit.record({
      entityType: 'entitlement_override',
      entityId: row.id,
      action: 'created',
      actorId,
      after: this.toOverrideContract(row) as unknown as Record<string, unknown>,
    });
    return this.toOverrideContract(row);
  }

  async revokeOverride(
    id: string,
    actorId: number,
  ): Promise<EntitlementOverrideContract> {
    const row = await this.overrides.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Override ${id} not found`);
    if (!row.revoked_at) {
      row.revoked_at = new Date();
      await this.overrides.save(row);
      await this.audit.record({
        entityType: 'entitlement_override',
        entityId: row.id,
        action: 'revoked',
        actorId,
        after: { revoked_at: row.revoked_at },
      });
    }
    return this.toOverrideContract(row);
  }

  // -------------------------------------------------------------- resolution

  /**
   * Precedence: override → robot subscription → organization subscription →
   * default plan → deny. The first source that *defines* the feature wins; a
   * source that is silent falls through to the next one.
   */
  async resolve(
    organizationId: string,
    featureKey: string,
    robotId?: string | null,
  ): Promise<EntitlementSnapshot> {
    const feature = await this.features.getOptional(featureKey);
    if (!feature) {
      return this.denySnapshot(featureKey, EntitlementDenyReason.FEATURE_NOT_IN_PLAN);
    }

    const override = await this.findActiveOverride(
      organizationId,
      featureKey,
      robotId ?? null,
    );
    if (override) {
      if (!override.enabled) {
        return {
          feature_key: featureKey,
          enabled: false,
          limit_value: this.toNumber(override.limit_value),
          source: EntitlementSource.OVERRIDE,
          reason: EntitlementDenyReason.OVERRIDE_DENIED,
          subscription_id: null,
          override_id: override.id,
          expires_at: override.expires_at
            ? override.expires_at.toISOString()
            : null,
        };
      }
      return {
        feature_key: featureKey,
        enabled: true,
        limit_value: this.toNumber(override.limit_value),
        source: EntitlementSource.OVERRIDE,
        reason: null,
        subscription_id: null,
        override_id: override.id,
        expires_at: override.expires_at
          ? override.expires_at.toISOString()
          : null,
      };
    }

    const candidates = await this.candidates(organizationId, robotId ?? null);
    if (!candidates.length) {
      return this.denySnapshot(featureKey, EntitlementDenyReason.NO_PLAN);
    }

    for (const candidate of candidates) {
      const planFeature = await this.plansService.getPlanFeature(
        candidate.planId,
        featureKey,
      );
      if (!planFeature) continue;

      return {
        feature_key: featureKey,
        enabled: planFeature.enabled,
        limit_value: this.toNumber(planFeature.limit_value),
        source: candidate.source,
        reason: planFeature.enabled
          ? null
          : EntitlementDenyReason.FEATURE_DISABLED,
        subscription_id: candidate.subscriptionId,
        override_id: null,
        expires_at: null,
      };
    }

    return this.denySnapshot(
      featureKey,
      EntitlementDenyReason.FEATURE_NOT_IN_PLAN,
    );
  }

  private async candidates(
    organizationId: string,
    robotId: string | null,
  ): Promise<Candidate[]> {
    const result: Candidate[] = [];

    if (robotId) {
      const robotSubscription =
        await this.subscriptions.findLiveRobotSubscription(robotId);
      if (
        robotSubscription &&
        robotSubscription.organization_id === organizationId
      ) {
        result.push({
          source: EntitlementSource.ROBOT_SUBSCRIPTION,
          planId: robotSubscription.plan_id,
          subscriptionId: robotSubscription.id,
        });
      }
    }

    const orgSubscription =
      await this.subscriptions.findLiveOrganizationSubscription(
        organizationId,
      );
    if (orgSubscription) {
      result.push({
        source: EntitlementSource.ORGANIZATION_SUBSCRIPTION,
        planId: orgSubscription.plan_id,
        subscriptionId: orgSubscription.id,
      });
    }

    const defaultPlan = await this.plans.findOne({
      where: { is_default: true, status: PlanStatus.ACTIVE },
      order: { version: 'DESC' },
    });
    if (defaultPlan) {
      result.push({
        source: EntitlementSource.PLAN_DEFAULT,
        planId: defaultPlan.id,
        subscriptionId: null,
      });
    }

    return result;
  }

  private async findActiveOverride(
    organizationId: string,
    featureKey: string,
    robotId: string | null,
  ): Promise<EntitlementOverride | null> {
    const rows = await this.overrides.find({
      where: {
        organization_id: organizationId,
        feature_key: featureKey,
        revoked_at: IsNull(),
      },
      order: { created_at: 'DESC' },
      take: 20,
    });
    const now = Date.now();
    const usable = rows.filter(
      (row) => !row.expires_at || row.expires_at.getTime() > now,
    );
    const forRobot = robotId
      ? usable.find((row) => row.robot_id === robotId)
      : undefined;
    return forRobot ?? usable.find((row) => row.robot_id === null) ?? null;
  }

  private denySnapshot(
    featureKey: string,
    reason: EntitlementDenyReason,
  ): EntitlementSnapshot {
    return {
      feature_key: featureKey,
      enabled: false,
      limit_value: null,
      source: EntitlementSource.NONE,
      reason,
      subscription_id: null,
      override_id: null,
      expires_at: null,
    };
  }

  // ------------------------------------------------------------------- check

  async check(dto: EntitlementCheckDto): Promise<EntitlementCheckResult> {
    const snapshot = await this.resolve(
      dto.organizationId,
      dto.featureKey,
      dto.robotId ?? null,
    );
    const periodStart = this.periodStart();
    const used = await this.readUsed(
      dto.organizationId,
      dto.featureKey,
      periodStart,
    );
    return this.evaluate(snapshot, {
      requested: dto.quantity ?? 1,
      used: Number(used.used),
      periodStart,
    });
  }

  private evaluate(
    snapshot: EntitlementSnapshot,
    usage: { requested: number; used: number; periodStart: string },
  ): EntitlementCheckResult {
    const limit = snapshot.limit_value;
    const base: EntitlementCheckResult = {
      ...snapshot,
      allowed: false,
      requested: usage.requested,
      used: usage.used,
      remaining: limit === null ? null : Math.max(0, limit - usage.used),
      period_start: usage.periodStart,
    };

    if (!snapshot.enabled) return base;

    if (limit !== null && usage.used + usage.requested > limit) {
      return {
        ...base,
        allowed: false,
        reason: EntitlementDenyReason.QUOTA_EXCEEDED,
      };
    }

    return {
      ...base,
      allowed: true,
      remaining:
        limit === null ? null : Math.max(0, limit - usage.used - usage.requested),
    };
  }

  /** Usage resets monthly for quota features. */
  private periodStart(period = 'month'): string {
    const now = new Date();
    if (period === 'day') return now.toISOString().slice(0, 10);
    if (period === 'total') return '1970-01-01';
    return `${now.toISOString().slice(0, 7)}-01`;
  }

  private async readUsed(
    organizationId: string,
    featureKey: string,
    periodStart: string,
  ): Promise<UsageCounter> {
    const row = await this.counters.findOne({
      where: {
        organization_id: organizationId,
        feature_key: featureKey,
        period_start: periodStart,
      },
    });
    return (
      row ?? {
        organization_id: organizationId,
        feature_key: featureKey,
        period_start: periodStart,
        used: '0',
        updated_at: new Date(),
      }
    );
  }

  // ----------------------------------------------------------------- consume

  async consume(
    dto: ConsumeEntitlementDto,
    actorId: number,
  ): Promise<ConsumeResult> {
    const snapshot = await this.resolve(
      dto.organizationId,
      dto.featureKey,
      dto.robotId ?? null,
    );
    const periodStart = this.periodStart();

    if (dto.idempotencyKey) {
      const existing = await this.consumptions.findOne({
        where: { idempotency_key: dto.idempotencyKey },
      });
      if (existing) {
        // The amount was already counted; report the current quota state
        // instead of reserving it a second time.
        const result = await this.check({ ...dto, quantity: 0 });
        return { ...result, duplicate: true };
      }
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const counter = await this.lockCounter(
        manager,
        dto.organizationId,
        dto.featureKey,
        periodStart,
      );
      const used = Number(counter.used);
      const check = this.evaluate(snapshot, {
        requested: dto.amount,
        used,
        periodStart,
      });
      if (!check.allowed) return check;

      counter.used = String(used + dto.amount);
      await manager.save(counter);
      await manager.save(
        manager.create(UsageConsumption, {
          organization_id: dto.organizationId,
          robot_id: dto.robotId ?? null,
          feature_key: dto.featureKey,
          period_start: periodStart,
          amount: dto.amount,
          idempotency_key: dto.idempotencyKey ?? null,
          actor_id: actorId,
        }),
      );

      return {
        ...check,
        used: used + dto.amount,
        remaining:
          snapshot.limit_value === null
            ? null
            : Math.max(0, snapshot.limit_value - used - dto.amount),
      };
    });

    await this.audit.record({
      entityType: 'usage',
      entityId: `${dto.organizationId}:${dto.featureKey}:${periodStart}`,
      action: result.allowed ? 'consumed' : 'rejected',
      actorId,
      after: {
        amount: dto.amount,
        used: result.used,
        reason: result.reason ?? null,
      },
    });

    return { ...result, duplicate: false };
  }

  private async lockCounter(
    manager: EntityManager,
    organizationId: string,
    featureKey: string,
    periodStart: string,
  ): Promise<UsageCounter> {
    const existing = await manager
      .getRepository(UsageCounter)
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.organization_id = :organizationId', { organizationId })
      .andWhere('c.feature_key = :featureKey', { featureKey })
      .andWhere('c.period_start = :periodStart', { periodStart })
      .getOne();

    if (existing) return existing;

    const created = manager.create(UsageCounter, {
      organization_id: organizationId,
      feature_key: featureKey,
      period_start: periodStart,
      used: '0',
    });
    await manager.save(created);
    return created;
  }

  // ------------------------------------------------------------------- usage

  async usage(
    organizationId: string,
    featureKey?: string,
    robotId?: string | null,
  ): Promise<UsageSnapshot[]> {
    if (featureKey) {
      const snapshot = await this.resolve(organizationId, featureKey, robotId);
      const periodStart = this.periodStart();
      const counter = await this.readUsed(
        organizationId,
        featureKey,
        periodStart,
      );
      const used = Number(counter.used);
      return [
        {
          feature_key: featureKey,
          period_start: periodStart,
          used,
          limit_value: snapshot.limit_value,
          remaining:
            snapshot.limit_value === null
              ? null
              : Math.max(0, snapshot.limit_value - used),
        },
      ];
    }

    const periodStart = this.periodStart();
    const counters = await this.counters.find({
      where: { organization_id: organizationId, period_start: periodStart },
      order: { feature_key: 'ASC' },
    });

    const snapshots: UsageSnapshot[] = [];
    for (const counter of counters) {
      const snapshot = await this.resolve(
        organizationId,
        counter.feature_key,
        null,
      );
      const used = Number(counter.used);
      snapshots.push({
        feature_key: counter.feature_key,
        period_start: counter.period_start,
        used,
        limit_value: snapshot.limit_value,
        remaining:
          snapshot.limit_value === null
            ? null
            : Math.max(0, snapshot.limit_value - used),
      });
    }
    return snapshots;
  }

  // ------------------------------------------------------------------ mapper

  private toOverrideContract(
    row: EntitlementOverride,
  ): EntitlementOverrideContract {
    return {
      id: row.id,
      organization_id: row.organization_id,
      robot_id: row.robot_id,
      feature_key: row.feature_key,
      enabled: row.enabled ?? false,
      limit_value: this.toNumber(row.limit_value),
      reason: row.reason,
      granted_by: row.granted_by,
      expires_at: row.expires_at ? row.expires_at.toISOString() : null,
      revoked_at: row.revoked_at ? row.revoked_at.toISOString() : null,
      created_at: row.created_at.toISOString(),
    };
  }

  private toNumber(value: string | number | null): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Exposed for tests and for the subscription guard. */
  static isLiveStatus(status: SubscriptionStatus): boolean {
    return (
      status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIALING
    );
  }

  /** Trial expiry helper used when resolving subscriptions. */
  static trialExpired(trialEndsAt: Date | null, now = new Date()): boolean {
    return !!trialEndsAt && trialEndsAt.getTime() + DAY_MS < now.getTime();
  }
}
