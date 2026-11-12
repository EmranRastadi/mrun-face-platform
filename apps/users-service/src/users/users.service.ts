import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { KafkaService } from '../kafka/kafka.service';
import { Topics } from '../kafka/topics';
import { AssignmentStatus, Role, ScopeType } from '@mrun/contracts';
import { RoleAssignment } from '../iam/entities/role-assignment.entity';
import { Role as RoleEntity } from '../iam/entities/role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(RoleAssignment)
    private assignmentsRepository: Repository<RoleAssignment>,
    @InjectRepository(RoleEntity)
    private rolesRepository: Repository<RoleEntity>,
    private kafka: KafkaService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    role: Role = Role.VIEWER,
  ): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
      ],
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      role,
    });

    const savedUser = await this.usersRepository.save(user);

    try {
      await this.kafka.emit(Topics.USER_CREATED, {
        userId: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
      });
    } catch (error) {
      // User creation must not fail because the event bus is unavailable.
      // The record is the source of truth; the event can be replayed later.
      console.error(
        `Failed to publish USER_CREATED for user ${savedUser.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.withoutPassword(savedUser);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByKeycloakSubject(subject: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { keycloak_sub: subject } });
  }

  /**
   * Binds a local account to a Keycloak identity exactly once. Re-linking an
   * account to a different subject is rejected: the Keycloak `sub` is the
   * stable identity, while the username is only a bootstrap lookup key.
   */
  async linkKeycloakSubject(id: number, subject: string): Promise<User> {
    const user = await this.findOne(id);
    if (user.keycloak_sub && user.keycloak_sub !== subject) {
      throw new ConflictException(
        'User is already linked to a different Keycloak identity',
      );
    }
    if (!user.keycloak_sub) {
      user.keycloak_sub = subject;
      await this.usersRepository.save(user);
    }
    return this.findOne(id);
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();
  }

  async countAdmins(): Promise<number> {
    return this.usersRepository.count({ where: { role: Role.ADMIN } });
  }

  async hasAdmin(): Promise<boolean> {
    return (await this.countAdmins()) > 0;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async updateRole(id: number, role: Role): Promise<User> {
    const user = await this.findOne(id);
    if (
      user.role === Role.ADMIN &&
      role !== Role.ADMIN &&
      (await this.countAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot demote the last admin');
    }
    user.role = role;
    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    if (user.role === Role.ADMIN && (await this.countAdmins()) <= 1) {
      throw new BadRequestException('Cannot delete the last admin');
    }

    const superAdminRole = await this.rolesRepository.findOne({
      where: { key: 'super_admin' },
    });
    if (superAdminRole) {
      const own = await this.assignmentsRepository.count({
        where: {
          user_id: id,
          role_id: superAdminRole.id,
          status: AssignmentStatus.ACTIVE,
        },
      });
      if (own > 0) {
        const total = await this.assignmentsRepository.count({
          where: {
            role_id: superAdminRole.id,
            scope_type: ScopeType.PLATFORM,
            status: AssignmentStatus.ACTIVE,
          },
        });
        if (total <= 1) {
          throw new BadRequestException('Cannot delete the last super admin');
        }
      }
    }

    await this.assignmentsRepository.update(
      { user_id: id, status: AssignmentStatus.ACTIVE },
      { status: AssignmentStatus.REVOKED, revoked_at: new Date() },
    );

    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  private withoutPassword(user: User): User {
    const publicUser = { ...user } as Partial<User>;
    delete publicUser.password;
    return publicUser as User;
  }
}
