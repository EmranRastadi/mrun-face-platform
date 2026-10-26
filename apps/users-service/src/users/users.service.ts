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
import { Role } from '../auth/roles.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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

    await this.kafka.emit(Topics.USER_CREATED, {
      userId: savedUser.id,
      username: savedUser.username,
      email: savedUser.email,
    });

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
