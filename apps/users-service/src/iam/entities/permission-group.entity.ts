import { randomUUID } from 'crypto';
import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('permission_groups')
@Index('idx_permission_groups_org', ['organization_id'])
@Unique('uq_permission_groups_org_key', ['organization_id', 'key'])
export class PermissionGroup {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 240, default: '' })
  description: string;

  @Column({ default: false })
  is_system: boolean;
}
