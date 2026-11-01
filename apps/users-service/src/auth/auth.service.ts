import { randomUUID } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import type { JwtClaims } from '@mrun/contracts';
import { AuthzService } from '../iam/authz/authz.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authz: AuthzService,
  ) {}

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

    const context = await this.authz.tokenContext(user.id);
    const payload: JwtClaims = {
      sub: String(user.id),
      username: user.username,
      role: user.role,
      active_org: context.activeOrganizationId,
      platform_staff: context.platformStaff,
      ver: context.permissionVersion,
      sid: randomUUID(),
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
        platform_staff: context.platformStaff,
        active_organization_id: context.activeOrganizationId,
      },
    };
  }
}
