import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { AssignmentStatus, ScopeType } from '@mrun/contracts';

@Entity('role_assignments')
@Index('idx_role_assignments_user_status', ['user_id', 'status'])
@Index('idx_role_assignments_scope', [
  'organization_id',
  'scope_type',
  'scope_id',
])
@Index('idx_role_assignments_role', ['role_id'])
export class RoleAssignment {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'uuid' })
  role_id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', length: 20 })
  scope_type: ScopeType;

  @Column({ type: 'uuid', nullable: true })
  scope_id: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: AssignmentStatus;

  @Column({ type: 'int', nullable: true })
  granted_by: number | null;

  @CreateDateColumn()
  granted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  reason: string | null;
}
