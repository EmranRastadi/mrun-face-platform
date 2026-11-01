import { Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('role_permissions')
@Index('idx_role_permissions_permission', ['permission_key'])
export class RolePermission {
  @PrimaryColumn({ type: 'uuid' })
  role_id: string;

  @PrimaryColumn({ type: 'varchar', length: 96 })
  permission_key: string;
}
