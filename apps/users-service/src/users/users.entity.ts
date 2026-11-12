import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '@mrun/contracts';

@Entity('users')
@Index('uq_users_keycloak_sub', ['keycloak_sub'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  @Exclude()
  password: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 20, default: Role.VIEWER })
  role: Role;

  // Stable external identity. Never link Keycloak accounts by username/email:
  // both are mutable in Keycloak and can be reassigned.
  @Column({ name: 'keycloak_sub', type: 'varchar', length: 64, nullable: true })
  keycloak_sub: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
