import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OrgUnitKind } from '@mrun/contracts';

@Entity('org_units')
@Index('idx_org_units_org_parent', ['organization_id', 'parent_id'])
@Index('idx_org_units_path', ['path'])
export class OrgUnit {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @Column({ type: 'varchar', length: 20 })
  kind: OrgUnitKind;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  code: string | null;

  /** Materialized path of unit ids: `/root/child/grandchild`. */
  @Column({ type: 'text', default: '' })
  path: string;

  @Column({ type: 'int', default: 0 })
  depth: number;

  @Column({ type: 'int', nullable: true })
  manager_user_id: number | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
