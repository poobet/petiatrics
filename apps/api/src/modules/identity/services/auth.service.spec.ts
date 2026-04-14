import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService } from '../../../common/session/session.service';
import { Role, Locale, UserStatus } from '@petiatrics/types';
import * as bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Prisma mock helpers
// ---------------------------------------------------------------------------
function makeUser(overrides: Partial<{
  id: string;
  email: string | null;
  username: string | null;
  passwordHash: string;
  role: string;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  clinicId: string | null;
  mustChangePassword: boolean;
  name: string;
  preferredLocale: string;
  businessPartnerId: string | null;
  clinic: Record<string, unknown> | null;
  userBranches: unknown[];
}> = {}) {
  return {
    id: 'user-1',
    email: 'test@clinic.com',
    username: null,
    passwordHash: bcrypt.hashSync('Password1!', 8),
    role: Role.VET,
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil: null,
    clinicId: 'clinic-1',
    mustChangePassword: false,
    name: 'Test User',
    preferredLocale: Locale.EN,
    businessPartnerId: null,
    clinic: { id: 'clinic-1', name: 'Test Clinic', slug: 'test-clinic', status: 'ACTIVE', settings: {} },
    userBranches: [{ branch: { id: 'branch-1', name: 'Main' } }],
    ...overrides,
  };
}

function makePrismaMock(user: ReturnType<typeof makeUser> | null = makeUser()) {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockImplementation((args: { data: unknown; where: unknown }) => {
        if (user) Object.assign(user, args.data);
        return Promise.resolve(user);
      }),
    },
    clinic: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

function makeSessionMock() {
  return {
    createSession: jest.fn().mockResolvedValue('mock-session-id'),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    getSession: jest.fn().mockResolvedValue(null),
    refreshSession: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let sessionMock: ReturnType<typeof makeSessionMock>;

  beforeEach(async () => {
    const user = makeUser();
    prismaMock = makePrismaMock(user);
    sessionMock = makeSessionMock();

    const { PrismaClient } = await import('@prisma/client');
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaClient, useValue: prismaMock },
        { provide: SessionService, useValue: sessionMock },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  // ─── Password policy ────────────────────────────────────────────────────

  describe('assertPasswordPolicy (via changePassword)', () => {
    it('rejects password shorter than 8 chars', async () => {
      await expect(service.changePassword('user-1', undefined, 'Ab1!')).rejects.toThrow(
        'at least 8 characters',
      );
    });

    it('rejects password without uppercase letter', async () => {
      await expect(service.changePassword('user-1', undefined, 'password1!')).rejects.toThrow(
        'uppercase',
      );
    });

    it('rejects password without lowercase letter', async () => {
      await expect(service.changePassword('user-1', undefined, 'PASSWORD1!')).rejects.toThrow(
        'lowercase',
      );
    });

    it('rejects password without digit', async () => {
      await expect(service.changePassword('user-1', undefined, 'Password!!')).rejects.toThrow(
        'digit',
      );
    });

    it('rejects password without special character', async () => {
      await expect(service.changePassword('user-1', undefined, 'Password1')).rejects.toThrow(
        'special character',
      );
    });

    it('accepts a valid password meeting all requirements', async () => {
      prismaMock.user.update.mockResolvedValue({});
      await expect(service.changePassword('user-1', undefined, 'Password1!')).resolves.not.toThrow();
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns sessionId and profile for valid credentials', async () => {
      const result = await service.login({ identifier: 'test@clinic.com', password: 'Password1!' });
      expect(result.sessionId).toBe('mock-session-id');
      expect(result.profile.email).toBe('test@clinic.com');
      expect(result.profile.role).toBe(Role.VET);
    });

    it('returns businessPartnerId in profile when user has BP linkage', async () => {
      prismaMock.user.findFirst = jest.fn().mockResolvedValue(
        makeUser({ businessPartnerId: 'bp-1' }),
      );
      const result = await service.login({ identifier: 'test@clinic.com', password: 'Password1!' });
      expect(result.profile.businessPartnerId).toBe('bp-1');
    });

    it('rejects missing credentials', async () => {
      await expect(service.login({ identifier: '', password: '' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects unknown user', async () => {
      prismaMock.user.findFirst = jest.fn().mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'unknown@user.com', password: 'Password1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects wrong password and increments failedLoginAttempts', async () => {
      await expect(
        service.login({ identifier: 'test@clinic.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 1 }) }),
      );
    });

    it('locks account after 5 failed attempts', async () => {
      const user = makeUser({ failedLoginAttempts: 4 });
      prismaMock.user.findFirst = jest.fn().mockResolvedValue(user);
      await expect(
        service.login({ identifier: 'test@clinic.com', password: 'WrongPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: UserStatus.LOCKED,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects login when account is locked and lock has not expired', async () => {
      const future = new Date(Date.now() + 10 * 60 * 1000);
      const user = makeUser({ status: UserStatus.LOCKED, lockedUntil: future });
      prismaMock.user.findFirst = jest.fn().mockResolvedValue(user);
      await expect(
        service.login({ identifier: 'test@clinic.com', password: 'Password1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('auto-resets lock when lockedUntil has passed', async () => {
      const past = new Date(Date.now() - 60 * 1000);
      const user = makeUser({ status: UserStatus.LOCKED, lockedUntil: past });
      prismaMock.user.findFirst = jest.fn().mockResolvedValue(user);
      const result = await service.login({ identifier: 'test@clinic.com', password: 'Password1!' });
      expect(result.sessionId).toBe('mock-session-id');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: UserStatus.ACTIVE, failedLoginAttempts: 0 }),
        }),
      );
    });
  });
});
