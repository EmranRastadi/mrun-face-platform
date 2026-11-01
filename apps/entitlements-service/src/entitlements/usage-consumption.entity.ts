import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Ledger of consumption calls. The optional `idempotency_key` makes retried
 * `POST /entitlements/consume` calls safe: the unique index guarantees the
 * same key is only ever counted once.
 */
@Entity('usage_consumptions')
@Index('idx_usage_consumptions_lookup', [
  'organization_id',
  'feature_key',
  'period_start',
])
@Index('uq_usage_consumptions_idempotency', ['idempotency_key'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class UsageConsumption {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  robot_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  feature_key: string;

  @Column({ type: 'date' })
  period_start: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 160, nullable: true })
  idempotency_key: string | null;

  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  @CreateDateColumn()
  created_at: Date;
}
