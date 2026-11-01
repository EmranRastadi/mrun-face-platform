import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('permission_group_items')
@Index('idx_permission_group_items_permission', ['permission_key'])
export class PermissionGroupItem {
  @PrimaryColumn({ type: 'uuid' })
  group_id: string;

  @PrimaryColumn({ type: 'varchar', length: 96 })
  permission_key: string;
}
