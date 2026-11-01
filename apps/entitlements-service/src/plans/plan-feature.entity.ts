import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * `limit_value` null means unlimited; `enabled=false` excludes the feature from
 * the plan entirely (the feature is then reported as not entitled).
 */
@Entity('plan_features')
@Index('idx_plan_features_feature', ['feature_key'])
export class PlanFeature {
  @PrimaryColumn({ type: 'uuid' })
  plan_id: string;

  @PrimaryColumn({ type: 'varchar', length: 120 })
  feature_key: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  limit_value: string | null;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;
}
