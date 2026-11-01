import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { GrantEffect } from '@mrun/contracts';

/**
 * Attribute-based policy. `condition` is a small JSON DSL (no eval):
 *   {"all":[{"eq":["resource.status","active"]}]}
 * Supported operators: all, any, not, eq, neq, in, contains, exists.
 */
@Entity('authorization_policies')
@Index('idx_authorization_policies_permission', ['permission_key', 'enabled'])
export class AuthorizationPolicy {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 96 })
  permission_key: string;

  @Column({ type: 'varchar', length: 8, default: 'deny' })
  effect: GrantEffect;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb' })
  condition: Record<string, unknown>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 240, default: '' })
  description: string;

  @CreateDateColumn()
  created_at: Date;
}
