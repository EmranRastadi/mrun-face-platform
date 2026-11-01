import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { MembershipStatus } from '@mrun/contracts';

@Entity('org_memberships')
@Index('uq_org_memberships_org_user', ['organization_id', 'user_id'], {
  unique: true,
})
@Index('idx_org_memberships_user', ['user_id', 'status'])
export class OrgMembership {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: MembershipStatus;

  @Column({ type: 'varchar', length: 120, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  employee_no: string | null;

  @Column({ default: false })
  is_primary: boolean;

  @CreateDateColumn()
  joined_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  left_at: Date | null;
}
