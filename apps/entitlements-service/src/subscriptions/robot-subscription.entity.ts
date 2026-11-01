import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SubscriptionStatus } from '@mrun/contracts';

/**
 * Optional per-robot commercial terms. When present they override the
 * organization subscription for that robot only.
 */
@Entity('robot_subscriptions')
@Index('idx_robot_subscriptions_robot_status', ['robot_id', 'status'])
@Index('idx_robot_subscriptions_org', ['organization_id'])
export class RobotSubscription {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 120 })
  robot_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: SubscriptionStatus;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  starts_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ends_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
