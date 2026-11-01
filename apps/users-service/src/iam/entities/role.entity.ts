import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { RoleKind } from '@mrun/contracts';

/**
 * System roles have `organization_id = NULL` and are shared by every tenant.
 * Custom roles are owned by exactly one organization.
 */
@Entity('roles')
@Index('uq_roles_org_key', ['organization_id', 'key'], {
  unique: true,
  where: '"organization_id" IS NOT NULL',
})
@Index('uq_roles_system_key', ['key'], {
  unique: true,
  where: '"organization_id" IS NULL',
})
export class Role {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 16, default: 'custom' })
  kind: RoleKind;

  @Column({ default: true })
  is_assignable: boolean;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
