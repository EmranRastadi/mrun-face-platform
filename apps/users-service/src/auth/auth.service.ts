import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Role } from '@mrun/contracts';
import { LoginDto } from './dto/login.dto';
import type { JwtClaims } from '@mrun/contracts';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.bootstrapAdmin();
    } catch (error) {
      this.logger.error(
        `Admin bootstrap failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async bootstrapAdmin(): Promise<void> {
    const username = this.configService.get<string>('BOOTSTRAP_ADMIN_USERNAME');
    const password = this.configService.get<string>('BOOTSTRAP_ADMIN_PASSWORD');
    if (!username || !password) {
      return;
    }

    const existing = await this.usersService.findByUsername(username);
    if (existing) {
      if (!(await this.usersService.hasAdmin())) {
        await this.usersService.updateRole(existing.id, Role.ADMIN);
      }
      return;
    }

    if (await this.usersService.hasAdmin()) {
      return;
    }

    await this.usersService.create(
      {
        username,
        email: this.configService.get<string>(
          'BOOTSTRAP_ADMIN_EMAIL',
          `${username}@mrun.local`,
        ),
        password,
        full_name: 'Bootstrap Admin',
      },
      Role.ADMIN,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByUsernameWithPassword(
      dto.username,
    );
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload: JwtClaims = {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      },
    };
  }
}
