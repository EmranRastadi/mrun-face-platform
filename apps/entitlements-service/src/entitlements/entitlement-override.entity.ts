import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Audited entitlement override. Highest precedence in resolution and always
 * scoped either to an organization (robot_id null) or a single robot.
 */
@Entity('entitlement_overrides')
@Index('idx_entitlement_overrides_lookup', [
  'organization_id',
  'feature_key',
  'revoked_at',
])
@Index('idx_entitlement_overrides_robot', ['robot_id'])
export class EntitlementOverride {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  robot_id: string | null;

  @Column({ type: 'varchar', length: 120 })
  feature_key: string;

  @Column({ type: 'boolean', nullable: true })
  enabled: boolean | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  limit_value: string | null;

  @Column({ type: 'varchar', length: 480, default: '' })
  reason: string;

  @Column({ type: 'int', nullable: true })
  granted_by: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
