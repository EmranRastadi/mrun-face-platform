import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { FeatureValueType } from '@mrun/contracts';

/**
 * A commercially controlled capability, e.g. `fleet.robots.max`,
 * `analytics.retention.days`, `support.sla.hours`.
 *
 * `key` is the stable identifier referenced by plans, overrides and callers.
 */
@Entity('features')
@Index('idx_features_category', ['category'])
export class Feature {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 480, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 16 })
  value_type: FeatureValueType;

  @Column({ type: 'varchar', length: 40, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 60, default: 'general' })
  category: string;

  @Column({ default: false })
  is_system: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
