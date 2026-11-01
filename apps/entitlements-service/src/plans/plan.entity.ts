import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PlanStatus } from '@mrun/contracts';

@Entity('plans')
@Index('uq_plans_key_version', ['key', 'version'], { unique: true })
@Index('idx_plans_status', ['status'])
export class Plan {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 480, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: PlanStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  /** Fallback plan applied when an organization has no subscription. */
  @Column({ default: false })
  is_default: boolean;

  @Column({ type: 'int', default: 0 })
  trial_days: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  price_monthly: string;

  @Column({ type: 'varchar', length: 8, default: 'USD' })
  currency: string;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
