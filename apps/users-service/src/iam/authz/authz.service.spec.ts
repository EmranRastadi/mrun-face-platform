import { AuthzService } from './authz.service';

/**
 * The ABAC condition DSL is the only place where policy JSON is interpreted.
 * These tests pin its supported operators so a malformed policy fails closed.
 */
describe('AuthzService condition DSL', () => {
  const service = new AuthzService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );

  const matches = (condition: unknown, facts: Record<string, unknown>) =>
    (service as unknown as {
      matches: (c: unknown, f: Record<string, unknown>) => boolean;
    }).matches(condition, facts);

  const facts = {
    user: { id: 7 },
    resource: { type: 'robot', id: 'r-1', organizationId: 'org-1' },
    context: { ip: '10.0.0.5', roles: ['operator'] },
  };

  it('evaluates eq/neq', () => {
    expect(matches({ eq: ['resource.type', 'robot'] }, facts)).toBe(true);
    expect(matches({ neq: ['resource.type', 'camera'] }, facts)).toBe(true);
  });

  it('evaluates in/contains/exists', () => {
    expect(matches({ in: ['context.roles', ['operator', 'admin']] }, facts)).toBe(
      true,
    );
    expect(matches({ contains: ['context.roles', 'operator'] }, facts)).toBe(true);
    expect(matches({ exists: ['resource.organizationId'] }, facts)).toBe(true);
    expect(matches({ exists: ['resource.missing'] }, facts)).toBe(false);
  });

  it('evaluates all/any/not', () => {
    expect(
      matches(
        {
          all: [
            { eq: ['resource.type', 'robot'] },
            { eq: ['context.ip', '10.0.0.5'] },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(
      matches(
        {
          any: [
            { eq: ['resource.type', 'camera'] },
            { eq: ['resource.type', 'robot'] },
          ],
        },
        facts,
      ),
    ).toBe(true);
    expect(matches({ not: { eq: ['resource.type', 'robot'] } }, facts)).toBe(
      false,
    );
  });

  it('fails closed on malformed conditions', () => {
    expect(matches(null, facts)).toBe(false);
    expect(matches('deny-everything', facts)).toBe(false);
    expect(matches({ unknown: [] }, facts)).toBe(false);
    expect(matches({ eq: ['missing.path', 'x'] }, facts)).toBe(false);
  });
});
