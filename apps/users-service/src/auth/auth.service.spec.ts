import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@mrun/contracts';
import { AuthService } from './auth.service';
import { KeycloakService } from './keycloak/keycloak.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { AuthzService } from '../iam/authz/authz.service';

const SUBJECT = '30d36691-72a0-49de-81a6-7591ba5f8b4d';

function localUser(overrides: Partial<User> = {}): User {
  return {
    id: 7,
    username: 'mrun',
    email: 'mrun@example.test',
    password: 'not-returned',
    full_name: 'MRUN User',
    is_active: true,
    role: Role.VIEWER,
    keycloak_sub: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function identity(overrides: Record<string, unknown> = {}) {
  return {
    subject: SUBJECT,
    username: 'mrun',
    email: 'mrun@example.test',
    fullName: 'MRUN User',
    role: Role.ADMIN,
    roleNames: ['admin'],
    issuer: 'http://keycloak.mrun-security.svc.cluster.local:8080/realms/mrun',
    clientId: 'mrun-backend',
    ...overrides,
  };
}

describe('AuthService Keycloak exchange', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let keycloak: {
    verifyToken: jest.Mock;
    autoProvision: boolean;
    syncRole: boolean;
  };
  let authz: { tokenContext: jest.Mock };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    users = {
      findByKeycloakSubject: jest.fn(),
      findByUsername: jest.fn(),
      linkKeycloakSubject: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    keycloak = {
      verifyToken: jest.fn().mockResolvedValue(identity()),
      autoProvision: true,
      syncRole: false,
    };

    authz = {
      tokenContext: jest.fn().mockResolvedValue({
        activeOrganizationId: null,
        platformStaff: false,
        permissionVersion: 1,
      }),
    };

    jwt = { signAsync: jest.fn().mockResolvedValue('platform-token') };

    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'JWT_EXPIRES_IN' ? '7d' : fallback,
      ),
    };

    service = new AuthService(
      users,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      authz as unknown as AuthzService,
      keycloak as unknown as KeycloakService,
    );
  });

  it('resolves a returning user by stable Keycloak subject', async () => {
    const linked = localUser({ keycloak_sub: SUBJECT });
    users.findByKeycloakSubject.mockResolvedValue(linked);

    const result = await service.exchangeKeycloakToken({
      access_token: 'keycloak-token',
    });

    expect(users.findByKeycloakSubject).toHaveBeenCalledWith(SUBJECT);
    expect(users.findByUsername).not.toHaveBeenCalled();
    expect(result.access_token).toBe('platform-token');
    expect(result.auth_provider).toBe('keycloak');
  });

  it('links an existing local account on its first Keycloak exchange', async () => {
    const existing = localUser();
    users.findByKeycloakSubject.mockResolvedValue(null);
    users.findByUsername.mockResolvedValue(existing);
    users.linkKeycloakSubject.mockResolvedValue(
      localUser({ keycloak_sub: SUBJECT }),
    );

    await service.exchangeKeycloakToken({ access_token: 'keycloak-token' });

    expect(users.linkKeycloakSubject).toHaveBeenCalledWith(
      existing.id,
      SUBJECT,
    );
  });

  it('rejects a username that is already linked to another Keycloak identity', async () => {
    users.findByKeycloakSubject.mockResolvedValue(null);
    users.findByUsername.mockResolvedValue(
      localUser({ keycloak_sub: 'another-subject' }),
    );

    await expect(
      service.exchangeKeycloakToken({ access_token: 'keycloak-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(users.linkKeycloakSubject).not.toHaveBeenCalled();
  });

  it('provisions new users as viewers while local IAM is authoritative', async () => {
    users.findByKeycloakSubject.mockResolvedValue(null);
    users.findByUsername.mockResolvedValue(null);
    users.create.mockImplementation(async (dto, role) =>
      localUser({ username: dto.username, email: dto.email, role }),
    );
    users.linkKeycloakSubject.mockResolvedValue(
      localUser({ keycloak_sub: SUBJECT, role: Role.VIEWER }),
    );

    await service.exchangeKeycloakToken({ access_token: 'keycloak-token' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'mrun' }),
      Role.VIEWER,
    );
    expect(users.linkKeycloakSubject).toHaveBeenCalledWith(7, SUBJECT);
  });

  it('seeds the Keycloak role only when role synchronization is enabled', async () => {
    keycloak.syncRole = true;
    users.findByKeycloakSubject.mockResolvedValue(null);
    users.findByUsername.mockResolvedValue(null);
    users.create.mockImplementation(async (dto, role) =>
      localUser({ username: dto.username, email: dto.email, role }),
    );
    users.linkKeycloakSubject.mockResolvedValue(
      localUser({ keycloak_sub: SUBJECT, role: Role.ADMIN }),
    );

    await service.exchangeKeycloakToken({ access_token: 'keycloak-token' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'mrun' }),
      Role.ADMIN,
    );
  });

  it('rejects a disabled local account even when Keycloak is active', async () => {
    users.findByKeycloakSubject.mockResolvedValue(
      localUser({ keycloak_sub: SUBJECT, is_active: false }),
    );

    await expect(
      service.exchangeKeycloakToken({ access_token: 'keycloak-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
