import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Consumable quota ledger. One row per organization/feature/billing period;
 * `consume()` takes a row lock before checking and incrementing so concurrent
 * calls cannot overshoot the limit.
 */
@Entity('usage_counters')
@Index('idx_usage_counters_period', ['period_start'])
export class UsageCounter {
  @PrimaryColumn({ type: 'uuid' })
  organization_id: string;

  @PrimaryColumn({ type: 'varchar', length: 120 })
  feature_key: string;

  @PrimaryColumn({ type: 'date' })
  period_start: string;

  @Column({ type: 'bigint', default: 0 })
  used: string;

  @UpdateDateColumn()
  updated_at: Date;
}
