import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import type { UserContext } from '@petiatrics/types';
import { Role, Locale } from '@petiatrics/types';

// ---------------------------------------------------------------------------
// Minimal in-memory Redis stub
// ---------------------------------------------------------------------------
function makeRedisStub() {
  const store = new Map<string, { value: string; expiresAt: number }>();

  return {
    setex: jest.fn((key: string, ttl: number, value: string) => {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(null);
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(entry.value);
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
    expire: jest.fn((key: string, ttl: number) => {
      const entry = store.get(key);
      if (!entry) return Promise.resolve(0);
      store.set(key, { value: entry.value, expiresAt: Date.now() + ttl * 1000 });
      return Promise.resolve(1);
    }),
    quit: jest.fn(() => Promise.resolve('OK')),
    _store: store,
  };
}

const mockContext: UserContext = {
  userId: 'user-1',
  clinicId: 'clinic-1',
  clinicName: 'Test Clinic',
  clinicSlug: 'test-clinic',
  role: Role.VET,
  roleId: 'role-vet-id',
  roleCode: 'VET',
  roleName: 'Veterinarian',
  systemRole: null,
  permissions: [],
  preferredLocale: Locale.EN,
  authorizedBranches: [{ id: 'branch-1', name: 'Main Branch' }],
};

describe('SessionService', () => {
  let service: SessionService;
  let redisMock: ReturnType<typeof makeRedisStub>;

  beforeEach(async () => {
    redisMock = makeRedisStub();
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn(() => 'redis://localhost') } },
      ],
    }).compile();

    service = module.get(SessionService);
    // Inject mock Redis
    (service as any).redis = redisMock;
  });

  describe('createSession', () => {
    it('stores session with issuedAt and idle TTL of 3600s', async () => {
      const id = await service.createSession(mockContext);
      expect(id).toBeDefined();
      expect(redisMock.setex).toHaveBeenCalledWith(
        `session:${id}`,
        3600,
        expect.stringContaining('"issuedAt"'),
      );
    });

    it('returns unique session ids', async () => {
      const id1 = await service.createSession(mockContext);
      const id2 = await service.createSession(mockContext);
      expect(id1).not.toBe(id2);
    });
  });

  describe('getSession', () => {
    it('returns context for a valid session', async () => {
      const id = await service.createSession(mockContext);
      const ctx = await service.getSession(id);
      expect(ctx?.userId).toBe('user-1');
    });

    it('returns null for unknown session id', async () => {
      const ctx = await service.getSession('not-a-real-id');
      expect(ctx).toBeNull();
    });

    it('returns null and deletes when session exceeds 12h absolute expiry', async () => {
      const id = await service.createSession(mockContext);
      const key = `session:${id}`;

      // Backdate issuedAt by 13 hours
      const raw = redisMock._store.get(key);
      if (!raw) throw new Error('session not found in store');
      const payload = JSON.parse(raw.value) as UserContext;
      payload.issuedAt = Date.now() - 13 * 60 * 60 * 1000;
      redisMock._store.set(key, { ...raw, value: JSON.stringify(payload) });

      const ctx = await service.getSession(id);
      expect(ctx).toBeNull();
      expect(redisMock.del).toHaveBeenCalledWith(key);
    });

    it('backfills authorizedBranches when missing from old sessions', async () => {
      const id = await service.createSession(mockContext);
      const key = `session:${id}`;
      const raw = redisMock._store.get(key);
      if (!raw) throw new Error('session not found in store');
      const payload = JSON.parse(raw.value) as UserContext;
      delete (payload as any).authorizedBranches;
      redisMock._store.set(key, { ...raw, value: JSON.stringify(payload) });

      const ctx = await service.getSession(id);
      expect(Array.isArray(ctx?.authorizedBranches)).toBe(true);
    });
  });

  describe('deleteSession', () => {
    it('removes the session', async () => {
      const id = await service.createSession(mockContext);
      await service.deleteSession(id);
      const ctx = await service.getSession(id);
      expect(ctx).toBeNull();
    });
  });

  describe('refreshSession (idle TTL)', () => {
    it('updates expiry for a valid session within absolute limit', async () => {
      const id = await service.createSession(mockContext);
      await service.refreshSession(id);
      expect(redisMock.expire).toHaveBeenCalledWith(`session:${id}`, 3600);
    });

    it('caps TTL to remaining absolute lifetime when close to 12h', async () => {
      const id = await service.createSession(mockContext);
      const key = `session:${id}`;

      // Backdate issuedAt to 11h 45min ago (15 min remaining)
      const raw = redisMock._store.get(key);
      if (!raw) throw new Error('session not found in store');
      const payload = JSON.parse(raw.value) as UserContext;
      payload.issuedAt = Date.now() - (11 * 60 + 45) * 60 * 1000;
      redisMock._store.set(key, { ...raw, value: JSON.stringify(payload) });

      await service.refreshSession(id);

      const [[, newTtl]] = (redisMock.expire as jest.Mock).mock.calls.slice(-1);
      expect(newTtl).toBeLessThan(3600);
      expect(newTtl).toBeLessThanOrEqual(15 * 60 + 5); // ~15 min remaining
    });

    it('deletes session and does not refresh when absolute limit exceeded', async () => {
      const id = await service.createSession(mockContext);
      const key = `session:${id}`;

      const raw = redisMock._store.get(key);
      if (!raw) throw new Error('session not found in store');
      const payload = JSON.parse(raw.value) as UserContext;
      payload.issuedAt = Date.now() - 13 * 60 * 60 * 1000;
      redisMock._store.set(key, { ...raw, value: JSON.stringify(payload) });

      await service.refreshSession(id);
      expect(redisMock.del).toHaveBeenCalledWith(key);
    });
  });
});
