import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PinVerificationService } from './pin-verification.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt to avoid slow hashing in tests
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function buildPrismaMock() {
  return {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

const CLINIC_ID = 'clinic-001';
const VET_USER = {
  id: 'user-vet-001',
  name: 'Dr. Somchai',
  role: 'VET',
  pinHash: '$2b$10$hashedPIN',
  status: 'ACTIVE',
};

describe('PinVerificationService', () => {
  let service: PinVerificationService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinVerificationService,
        { provide: PrismaClient, useValue: prisma },
      ],
    }).compile();

    service = module.get<PinVerificationService>(PinVerificationService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── verifyPin() ────────────────────────────────────────────────────────────

  describe('verifyPin()', () => {
    it('returns authorized result when PIN matches and user is a VET', async () => {
      prisma.user.findFirst.mockResolvedValue(VET_USER);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.verifyPin(CLINIC_ID, VET_USER.id, '1234');
      expect(result.authorized).toBe(true);
      expect(result.supervisorId).toBe(VET_USER.id);
      expect(result.role).toBe('VET');
    });

    it('throws BadRequestException when PIN is too short', async () => {
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '12')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when PIN is too long (>8)', async () => {
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '123456789')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.verifyPin(CLINIC_ID, 'bad-id', '1234')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user has no PIN set', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...VET_USER, pinHash: null });
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '1234')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user role is not authorized (CASHIER)', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...VET_USER, role: 'CASHIER', pinHash: 'somehash' });
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '1234')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when user account is not ACTIVE', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...VET_USER, status: 'LOCKED' });
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '1234')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when PIN is incorrect', async () => {
      prisma.user.findFirst.mockResolvedValue(VET_USER);
      mockBcrypt.compare.mockResolvedValue(false as never);
      await expect(service.verifyPin(CLINIC_ID, VET_USER.id, '9999')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ─── setPin() ───────────────────────────────────────────────────────────────

  describe('setPin()', () => {
    it('hashes and stores the PIN', async () => {
      mockBcrypt.hash.mockResolvedValue('$2b$10$newHashedPin' as never);
      prisma.user.update.mockResolvedValue({} as any);

      await service.setPin('user-001', '5678');
      expect(mockBcrypt.hash).toHaveBeenCalledWith('5678', 10);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { pinHash: '$2b$10$newHashedPin' },
      });
    });

    it('throws BadRequestException for non-numeric PIN', async () => {
      await expect(service.setPin('user-001', 'abcd')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for PIN under 4 digits', async () => {
      await expect(service.setPin('user-001', '123')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── clearPin() ─────────────────────────────────────────────────────────────

  describe('clearPin()', () => {
    it('sets pinHash to null', async () => {
      prisma.user.update.mockResolvedValue({} as any);
      await service.clearPin('user-001');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { pinHash: null },
      });
    });
  });
});
