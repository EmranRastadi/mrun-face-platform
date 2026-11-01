import { randomUUID } from 'crypto';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('org_unit_members')
@Index('uq_org_unit_members', ['org_unit_id', 'user_id'], { unique: true })
export class OrgUnitMember {
  @PrimaryColumn('uuid')
  id: string = randomUUID();

  @Column({ type: 'uuid' })
  org_unit_id: string;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ default: false })
  is_lead: boolean;

  @CreateDateColumn()
  joined_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  left_at: Date | null;
}
