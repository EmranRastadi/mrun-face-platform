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

@Entity('organization_subscriptions')
@Index('idx_org_subscriptions_org_status', ['organization_id', 'status'])
@Index('idx_org_subscriptions_plan', ['plan_id'])
export class OrganizationSubscription {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: SubscriptionStatus;

  @Column({ type: 'int', nullable: true })
  seats: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  starts_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ends_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ends_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  external_ref: string | null;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
