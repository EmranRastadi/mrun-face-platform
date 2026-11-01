import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Commercial audit trail: who changed a plan, subscription or override. */
@Entity('entitlement_audit')
@Index('idx_entitlement_audit_entity', ['entity_type', 'entity_id'])
@Index('idx_entitlement_audit_created', ['created_at'])
export class EntitlementAudit {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'varchar', length: 40 })
  entity_type: string;

  @Column({ type: 'varchar', length: 120 })
  entity_id: string;

  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'int', nullable: true })
  actor_id: number | null;

  @Column({ type: 'jsonb', nullable: true })
  before_state: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after_state: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}
