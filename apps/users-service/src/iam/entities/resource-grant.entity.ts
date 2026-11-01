import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { GrantEffect, GrantSubjectType } from '@mrun/contracts';

@Entity('resource_grants')
@Index('idx_resource_grants_resource', ['resource_type', 'resource_id'])
@Index('idx_resource_grants_org', ['organization_id'])
export class ResourceGrant {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 40 })
  resource_type: string;

  @Column({ type: 'varchar', length: 120 })
  resource_id: string;

  @Column({ type: 'varchar', length: 16 })
  subject_type: GrantSubjectType;

  @Column({ type: 'varchar', length: 120 })
  subject_id: string;

  @Column({ type: 'varchar', length: 96 })
  permission_key: string;

  @Column({ type: 'varchar', length: 8, default: 'allow' })
  effect: GrantEffect;

  @Column({ type: 'int', nullable: true })
  granted_by: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
