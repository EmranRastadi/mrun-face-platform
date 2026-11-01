import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PermissionTier } from '@mrun/contracts';

@Entity('permissions')
export class Permission {
  /** `resource:action`, e.g. `robots:control`. `*` is the super-admin wildcard. */
  @PrimaryColumn({ type: 'varchar', length: 96 })
  key: string;

  @Column({ type: 'varchar', length: 48 })
  resource: string;

  @Column({ type: 'varchar', length: 48 })
  action: string;

  @Column({ type: 'varchar', length: 240 })
  description: string;

  @Column({ type: 'varchar', length: 16 })
  tier: PermissionTier;

  @Column({ default: true })
  is_system: boolean;
}
