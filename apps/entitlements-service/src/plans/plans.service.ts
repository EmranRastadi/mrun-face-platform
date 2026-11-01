import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  PlanStatus,
  type Plan as PlanContract,
  type PlanFeature as PlanFeatureContract,
} from '@mrun/contracts';
import { Plan } from './plan.entity';
import { PlanFeature } from './plan-feature.entity';
import { Feature } from '../features/feature.entity';
import {
  CreatePlanDto,
  PlanFeatureInputDto,
  SetPlanFeaturesDto,
  UpdatePlanDto,
} from '../dto/entitlements.dto';

export interface PlanWithFeatures extends PlanContract {
  features: PlanFeatureContract[];
}

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
    @InjectRepository(PlanFeature)
    private readonly planFeatures: Repository<PlanFeature>,
    @InjectRepository(Feature)
    private readonly features: Repository<Feature>,
    private readonly dataSource: DataSource,
  ) {}

  async list(includeRetired = false): Promise<PlanWithFeatures[]> {
    const rows = await this.plans.find({
      where: includeRetired
        ? {}
        : [{ status: PlanStatus.ACTIVE }, { status: PlanStatus.DRAFT }],
      order: { key: 'ASC', version: 'DESC' },
    });
    return this.withFeatures(rows);
  }

  async get(id: string): Promise<PlanWithFeatures> {
    const plan = await this.getEntity(id);
    const [result] = await this.withFeatures([plan]);
    return result;
  }

  async getEntity(id: string): Promise<Plan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async create(dto: CreatePlanDto, actorId: number): Promise<PlanWithFeatures> {
    const existing = await this.plans.findOne({
      where: { key: dto.key, version: 1 },
    });
    if (existing) {
      throw new ConflictException(`Plan "${dto.key}" already exists`);
    }

    const featureRows = dto.features ?? [];
    await this.assertFeaturesExist(featureRows.map((f) => f.featureKey));

    const plan = await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault) {
        await manager.update(Plan, { is_default: true }, { is_default: false });
      }
      const saved = await manager.save(
        manager.create(Plan, {
          key: dto.key,
          name: dto.name,
          description: dto.description ?? '',
          status: dto.status ?? PlanStatus.DRAFT,
          version: 1,
          is_default: dto.isDefault ?? false,
          trial_days: dto.trialDays ?? 0,
          price_monthly:
            dto.priceMonthly === null || dto.priceMonthly === undefined
              ? '0'
              : String(dto.priceMonthly),
          currency: dto.currency ?? 'USD',
          created_by: actorId,
        }),
      );
      await this.replaceFeatures(manager, saved.id, featureRows);
      return saved;
    });

    return this.get(plan.id);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanWithFeatures> {
    const plan = await this.getEntity(id);
    if (plan.status === PlanStatus.RETIRED) {
      throw new BadRequestException('Retired plans cannot be updated');
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.status !== undefined) plan.status = dto.status;
    if (dto.trialDays !== undefined) plan.trial_days = dto.trialDays;
    if (dto.priceMonthly !== undefined) {
      plan.price_monthly =
        dto.priceMonthly === null ? '0' : String(dto.priceMonthly);
    }
    if (dto.currency !== undefined) plan.currency = dto.currency;

    await this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await manager.update(Plan, { is_default: true }, { is_default: false });
      }
      if (dto.isDefault !== undefined) plan.is_default = dto.isDefault;
      await manager.save(plan);
    });

    return this.get(plan.id);
  }

  async setFeatures(
    id: string,
    dto: SetPlanFeaturesDto,
  ): Promise<PlanWithFeatures> {
    const plan = await this.getEntity(id);
    if (plan.status === PlanStatus.RETIRED) {
      throw new BadRequestException('Retired plans cannot be updated');
    }
    await this.assertFeaturesExist(dto.features.map((f) => f.featureKey));

    await this.dataSource.transaction(async (manager) => {
      await this.replaceFeatures(manager, plan.id, dto.features);
    });
    return this.get(plan.id);
  }

  async getPlanFeature(
    planId: string,
    featureKey: string,
  ): Promise<PlanFeature | null> {
    return this.planFeatures.findOne({
      where: { plan_id: planId, feature_key: featureKey },
    });
  }

  /** Plans referenced by subscriptions must stay usable. */
  async assertAssignable(plan: Plan): Promise<void> {
    if (plan.status === PlanStatus.RETIRED) {
      throw new BadRequestException(
        `Plan "${plan.key}" is retired and cannot be assigned`,
      );
    }
  }

  private async assertFeaturesExist(keys: string[]): Promise<void> {
    const unique = [...new Set(keys)];
    if (!unique.length) return;
    const rows = await this.features.find({ where: { key: In(unique) } });
    const found = new Set(rows.map((r) => r.key));
    const missing = unique.filter((key) => !found.has(key));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown features: ${missing.join(', ')}`,
      );
    }
  }

  private async replaceFeatures(
    manager: { delete: Function; save: Function; create: Function },
    planId: string,
    rows: PlanFeatureInputDto[],
  ): Promise<void> {
    await manager.delete(PlanFeature, { plan_id: planId });
    if (!rows.length) return;
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.featureKey)) {
        throw new BadRequestException(
          `Duplicate feature in plan: ${row.featureKey}`,
        );
      }
      seen.add(row.featureKey);
    }
    await manager.save(
      rows.map((row) =>
        manager.create(PlanFeature, {
          plan_id: planId,
          feature_key: row.featureKey,
          enabled: row.enabled ?? true,
          limit_value: row.limitValue ?? null,
          config: row.config ?? null,
        }),
      ),
    );
  }

  private async withFeatures(rows: Plan[]): Promise<PlanWithFeatures[]> {
    if (!rows.length) return [];
    const features = await this.planFeatures.find({
      where: { plan_id: In(rows.map((row) => row.id)) },
      order: { feature_key: 'ASC' },
    });
    const byPlan = new Map<string, PlanFeatureContract[]>();
    for (const row of features) {
      const list = byPlan.get(row.plan_id) ?? [];
      list.push({
        feature_key: row.feature_key,
        enabled: row.enabled,
        limit_value: row.limit_value === null ? null : Number(row.limit_value),
        config: row.config,
      });
      byPlan.set(row.plan_id, list);
    }
    return rows.map((row) => ({
      ...this.toContract(row),
      features: byPlan.get(row.id) ?? [],
    }));
  }

  toContract(plan: Plan): PlanContract {
    return {
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      version: plan.version,
      is_default: plan.is_default,
      trial_days: plan.trial_days,
      price_monthly:
        plan.price_monthly === null ? null : Number(plan.price_monthly),
      currency: plan.currency,
      created_by: plan.created_by,
      created_at: plan.created_at.toISOString(),
      updated_at: plan.updated_at.toISOString(),
    };
  }
}
