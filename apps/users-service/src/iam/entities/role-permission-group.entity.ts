import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('role_permission_groups')
@Index('idx_role_permission_groups_group', ['group_id'])
export class RolePermissionGroup {
  @PrimaryColumn({ type: 'uuid' })
  role_id: string;

  @PrimaryColumn({ type: 'uuid' })
  group_id: string;
}
