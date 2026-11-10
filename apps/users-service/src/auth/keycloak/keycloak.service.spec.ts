import { createPublicKey, generateKeyPairSync } from 'crypto';
import type { JsonWebKey } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@mrun/contracts';
import { KeycloakService } from './keycloak.service';

const ISSUER =
  'http://keycloak.mrun-security.svc.cluster.local:8080/realms/mrun';
const CLIENT_ID = 'mrun-backend';
const KID = 'test-signing-key';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const publicJwk = createPublicKey(publicKey).export({
  format: 'jwk',
}) as JsonWebKey;

const signer = new JwtService({});

function sign(overrides: Record<string, unknown> = {}): Promise<string> {
  return signer.signAsync(
    {
      sub: '30d36691-72a0-49de-81a6-7591ba5f8b4d',
      preferred_username: 'mrun',
      email: 'mrun@gmail.com',
      name: 'Emran Rastadi',
      iss: ISSUER,
      azp: CLIENT_ID,
      realm_access: { roles: ['user'] },
      ...overrides,
    },
    {
      privateKey,
      algorithm: 'RS256',
      keyid: KID,
      expiresIn: '5m',
    },
  );
}

function createService(
  overrides: Record<string, string | undefined> = {},
): KeycloakService {
  const values: Record<string, string | undefined> = {
    KEYCLOAK_ENABLED: 'true',
    KEYCLOAK_URL: 'http://keycloak.mrun-security.svc.cluster.local:8080',
    KEYCLOAK_REALM: 'mrun',
    KEYCLOAK_CLIENT_ID: CLIENT_ID,
    KEYCLOAK_ISSUERS: ISSUER,
    KEYCLOAK_ALLOWED_CLIENTS: CLIENT_ID,
    ...overrides,
  };

  const config = {
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService;

  return new KeycloakService(config);
}

describe('KeycloakService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        keys: [{ ...publicJwk, kid: KID, alg: 'RS256', use: 'sig' }],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('verifies an RS256 token and maps realm/client roles', async () => {
    const service = createService();
    const identity = await service.verifyToken(
      await sign({
        realm_access: { roles: ['user', 'admin'] },
        resource_access: { [CLIENT_ID]: { roles: ['operator'] } },
      }),
    );

    expect(identity).toEqual({
      subject: '30d36691-72a0-49de-81a6-7591ba5f8b4d',
      username: 'mrun',
      email: 'mrun@gmail.com',
      fullName: 'Emran Rastadi',
      role: Role.ADMIN,
      roleNames: ['user', 'admin', 'operator'],
      issuer: ISSUER,
      clientId: CLIENT_ID,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches JWKS keys between verifications', async () => {
    const service = createService();

    await service.verifyToken(await sign());
    await service.verifyToken(await sign());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps operator and default roles', async () => {
    const service = createService();

    const operator = await service.verifyToken(
      await sign({ realm_access: { roles: ['operator'] } }),
    );
    const viewer = await service.verifyToken(await sign());

    expect(operator.role).toBe(Role.OPERATOR);
    expect(viewer.role).toBe(Role.VIEWER);
  });

  it('rejects a token from an unknown issuer', async () => {
    const service = createService();

    await expect(
      service.verifyToken(await sign({ iss: 'http://evil.example/realms/mrun' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token for a client that is not allowed', async () => {
    const service = createService();

    await expect(
      service.verifyToken(await sign({ azp: 'some-other-client' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects unsupported token algorithms before verification', async () => {
    const service = createService();
    const hsToken = signer.sign(
      { sub: '1', preferred_username: 'mrun', iss: ISSUER, azp: CLIENT_ID },
      { secret: 'not-the-keycloak-key', algorithm: 'HS256' },
    );

    await expect(service.verifyToken(hsToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('falls back to a configured static public key when JWKS fails', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'));
    const service = createService({ KEYCLOAK_PUBLIC_KEY: publicKey });

    const identity = await service.verifyToken(await sign());

    expect(identity.username).toBe('mrun');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a disabled integration distinctly', async () => {
    const service = createService({ KEYCLOAK_ENABLED: 'false' });

    await expect(service.verifyToken(await sign())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('exposes provisioning flags as booleans', () => {
    const service = createService({
      KEYCLOAK_AUTO_PROVISION: 'true',
      KEYCLOAK_SYNC_ROLE: 'false',
    });

    expect(service.autoProvision).toBe(true);
    expect(service.syncRole).toBe(false);
  });
});
