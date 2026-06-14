import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Role } from '@petiatrics/types';

const BCRYPT_ROUNDS = 10; // PIN hashes use fewer rounds (shorter string, faster UX at POS)
const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 8;

/** Roles that are allowed to authorise a POS override via PIN. */
export const PIN_AUTHORIZED_ROLES: Role[] = [Role.VET, Role.CLINIC_OWNER];

export interface PinVerifyResult {
  authorized: boolean;
  supervisorId: string;
  supervisorName: string | null;
  role: Role;
}

@Injectable()
export class PinVerificationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Verify a supervisor PIN for a given clinic.
   * Returns the authorizing user's profile on success.
   * Throws UnauthorizedException on failure — always with an opaque message
   * to avoid leaking information about which user IDs have a PIN set.
   */
  async verifyPin(clinicId: string, supervisorUserId: string, pin: string): Promise<PinVerifyResult> {
    if (!pin || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
      throw new BadRequestException(`PIN must be between ${PIN_MIN_LENGTH} and ${PIN_MAX_LENGTH} digits.`);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: supervisorUserId, clinicId },
      select: { id: true, name: true, role: true, pinHash: true, status: true },
    });

    if (!user || !user.pinHash) {
      throw new UnauthorizedException('PIN verification failed.');
    }

    if (!PIN_AUTHORIZED_ROLES.includes(user.role as unknown as Role)) {
      throw new UnauthorizedException('PIN verification failed.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('PIN verification failed.');
    }

    const valid = await bcrypt.compare(pin, user.pinHash);
    if (!valid) {
      throw new UnauthorizedException('PIN verification failed.');
    }

    return {
      authorized: true,
      supervisorId: user.id,
      supervisorName: user.name,
      role: user.role as unknown as Role,
    };
  }

  /**
   * Verify an override PIN against all active VET or CLINIC_OWNER users in a clinic.
   * Returns user details of the authorizer if correct.
   */
  async verifyOverridePin(clinicId: string, pin: string): Promise<{ id: string; name: string; role: Role }> {
    if (!pin || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH || !/^\d+$/.test(pin)) {
      throw new BadRequestException(`PIN must be digits only and between ${PIN_MIN_LENGTH} and ${PIN_MAX_LENGTH} characters.`);
    }

    const supervisors = await this.prisma.user.findMany({
      where: {
        clinicId,
        role: { in: [Role.VET, Role.CLINIC_OWNER] },
        status: 'ACTIVE',
        pinHash: { not: null },
      },
      select: { id: true, name: true, role: true, pinHash: true },
    });

    for (const supervisor of supervisors) {
      if (supervisor.pinHash) {
        const match = await bcrypt.compare(pin, supervisor.pinHash);
        if (match) {
          return {
            id: supervisor.id,
            name: supervisor.name,
            role: supervisor.role as unknown as Role,
          };
        }
      }
    }

    throw new UnauthorizedException('Invalid supervisor PIN.');
  }

  /**
   * Set or update the supervisor PIN for a user.
   * Only the user themselves or a CLINIC_OWNER can do this.
   */
  async setPin(userId: string, pin: string): Promise<void> {
    if (!pin || pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
      throw new BadRequestException(`PIN must be between ${PIN_MIN_LENGTH} and ${PIN_MAX_LENGTH} digits.`);
    }
    if (!/^\d+$/.test(pin)) {
      throw new BadRequestException('PIN must contain digits only.');
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });
  }

  /**
   * Clear a user's PIN.
   */
  async clearPin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: null },
    });
  }
}
