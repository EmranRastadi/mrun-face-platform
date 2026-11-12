import { randomBytes, randomUUID } from 'crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { KeycloakExchangeDto } from './dto/keycloak-exchange.dto';
import { Role } from '@mrun/contracts';
import type { JwtClaims } from '@mrun/contracts';
import { AuthzService } from '../iam/authz/authz.service';
import { KeycloakIdentity, KeycloakService } from './keycloak/keycloak.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authz: AuthzService,
    private readonly keycloak: KeycloakService,
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

    return this.issuePlatformToken(user);
  }

  /**
   * Exchanges a Keycloak access token for the platform's own HS256 token.
   *
   * Keycloak is the identity provider at the edge. Downstream services keep
   * verifying the existing platform token and integer user IDs, so the
   * exchange maps the Keycloak username to a local user instead of leaking
   * Keycloak's UUID subject through the platform.
   */
  async exchangeKeycloakToken(dto: KeycloakExchangeDto) {
    const identity = await this.keycloak.verifyToken(dto.access_token);
    let user = await this.resolveKeycloakUser(identity);

    if (!user.is_active) {
      throw new UnauthorizedException('User account is disabled');
    }

    if (this.keycloak.syncRole && user.role !== identity.role) {
      user = await this.usersService.updateRole(user.id, identity.role);
    }

    return {
      ...(await this.issuePlatformToken(user)),
      auth_provider: 'keycloak',
    };
  }

  /**
   * Resolution order:
   * 1. stable Keycloak `sub` (the normal path after the first exchange),
   * 2. username for accounts created before Keycloak linking existed,
   * 3. optional just-in-time provisioning.
   *
   * A username is only a migration/bootstrap key. Once a local account has a
   * `keycloak_sub`, a different subject can never take it over by reusing the
   * same username or e-mail address.
   */
  private async resolveKeycloakUser(identity: KeycloakIdentity): Promise<User> {
    let user = await this.usersService.findByKeycloakSubject(identity.subject);

    if (!user) {
      user = await this.usersService.findByUsername(identity.username);
      if (user) {
        user = await this.linkKeycloakUser(user, identity.subject);
      }
    }

    if (!user) {
      if (!this.keycloak.autoProvision) {
        throw new UnauthorizedException(
          `Keycloak user "${identity.username}" is not provisioned on the platform`,
        );
      }

      const createUser: CreateUserDto = {
        username: identity.username,
        email: identity.email ?? `${identity.username}@keycloak.local`,
        // The local password is never used for Keycloak-authenticated users.
        // A random value keeps the existing password column non-nullable.
        password: randomBytes(32).toString('hex'),
        full_name: identity.fullName,
      };

      // Least privilege: local IAM is authoritative for authorization. Only
      // seed the coarse role from Keycloak when role synchronization is
      // explicitly enabled; otherwise new users start as viewers.
      const initialRole = this.keycloak.syncRole ? identity.role : Role.VIEWER;

      try {
        user = await this.usersService.create(createUser, initialRole);
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }

        // A concurrent exchange may have provisioned the same account
        // between our lookup and insert. Re-read by both stable and bootstrap
        // keys before failing the request.
        user =
          (await this.usersService.findByKeycloakSubject(identity.subject)) ??
          (await this.usersService.findByUsername(identity.username));
        if (!user) {
          throw new UnauthorizedException(
            `Keycloak user "${identity.username}" conflicts with an existing account`,
          );
        }
      }

      user = await this.linkKeycloakUser(user, identity.subject);
    }

    return user;
  }

  private async linkKeycloakUser(user: User, subject: string): Promise<User> {
    if (user.keycloak_sub === subject) return user;
    if (user.keycloak_sub) {
      throw new UnauthorizedException(
        'This account is linked to a different Keycloak identity',
      );
    }

    try {
      return await this.usersService.linkKeycloakSubject(user.id, subject);
    } catch (error) {
      // Another request may have won the one-time link race. If it linked the
      // same subject we can continue; otherwise the conflict is real.
      const linked = await this.usersService.findByKeycloakSubject(subject);
      if (linked) return linked;
      throw error;
    }
  }

  private async issuePlatformToken(user: User) {
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
