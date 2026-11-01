import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Token/permission invalidation counters. Bumping `permission_version` makes
 * previously cached PDP decisions and issued tokens stale.
 */
@Entity('principal_versions')
export class PrincipalVersion {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @Column({ type: 'int', default: 1 })
  token_version: number;

  @Column({ type: 'int', default: 1 })
  permission_version: number;

  @UpdateDateColumn()
  updated_at: Date;
}
