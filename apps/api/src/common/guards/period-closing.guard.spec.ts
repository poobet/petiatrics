import { Test, TestingModule } from '@nestjs/testing';
import { PeriodClosingGuard } from './period-closing.guard';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('PeriodClosingGuard', () => {
  let guard: PeriodClosingGuard;
  let reflector: Reflector;
  let prisma: PrismaClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodClosingGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: PrismaClient,
          useValue: {
            accountingPeriod: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    guard = module.get<PeriodClosingGuard>(PeriodClosingGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaClient>(PrismaClient);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request if no CheckPeriodField decorator is present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = {
      getHandler: () => {},
      getClass: () => {},
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow request if target period is OPEN or non-existent', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('adjustmentDate');
    jest.spyOn(prisma.accountingPeriod, 'findUnique').mockResolvedValue(null as any);

    const request = {
      body: { adjustmentDate: '2026-07-15' },
      headers: { 'x-tenant-id': 'clinic-123' },
    };

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if target period is CLOSED', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('adjustmentDate');
    jest.spyOn(prisma.accountingPeriod, 'findUnique').mockResolvedValue({
      id: 'period-1',
      clinicId: 'clinic-123',
      year: 2026,
      month: 7,
      status: 'CLOSED',
      closedAt: new Date('2026-07-31'),
    } as any);

    const request = {
      body: { adjustmentDate: '2026-07-15' },
      headers: { 'x-tenant-id': 'clinic-123' },
    };

    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
