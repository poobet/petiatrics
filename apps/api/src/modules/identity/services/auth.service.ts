import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { SessionService } from '../../../common/session/session.service';
import { Role, Locale, UserStatus } from '@petiatrics/types';
import type { UserContext, AuthProfile } from '@petiatrics/types';

const BCRYPT_ROUNDS = 12;

function assertPasswordPolicy(password: string): void {
  if (password.length < 8) throw new ConflictException('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) throw new ConflictException('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(password)) throw new ConflictException('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(password)) throw new ConflictException('Password must contain at least one digit.');
  if (!/[^A-Za-z0-9]/.test(password)) throw new ConflictException('Password must contain at least one special character.');
}

export interface LoginDto {
  /** Email address OR username@clinicSlug */
  identifier: string;
  password: string;
}

export interface LoginResult {
  sessionId: string;
  profile: AuthProfile;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessions: SessionService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string): Promise<LoginResult> {
    const { identifier, password } = dto;
    if (!identifier || !password) {
      throw new UnauthorizedException('Invalid credentials.');
    }
    const identifierNorm = identifier.toLowerCase().trim();

    const includeShape = {
      clinic: { select: { id: true, name: true, slug: true, status: true, settings: true, currencyCode: true } },
      userBranches: {
        include: { branch: { select: { id: true, name: true } } },
      },
    } as const;

    // Dual identifier resolution: try email first, then username@clinicSlug
    let user = await this.prisma.user.findFirst({
      where: { email: identifierNorm },
      include: includeShape,
    });

    if (!user && identifierNorm.includes('@')) {
      const atIndex = identifierNorm.lastIndexOf('@');
      const clinicSlug = identifierNorm.slice(atIndex + 1);
      const clinic = await this.prisma.clinic.findUnique({ where: { slug: clinicSlug } });
      if (clinic) {
        user = await this.prisma.user.findFirst({
          where: { username: identifierNorm, clinicId: clinic.id },
          include: includeShape,
        });
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // PENDING accounts cannot log in
    if (user.status === ('PENDING' as any)) {
      throw new UnauthorizedException('Account pending approval. Please wait for administrator confirmation.');
    }

    // Account lockout check
    if (user.status === UserStatus.LOCKED) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException(
          'Account locked due to too many failed attempts. Please try again later.',
        );
      }
      // Lockout expired — reset
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE as any, failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive. Contact your administrator.');
    }

    // Suspended clinic check
    if (user.clinic && user.clinic.status === 'SUSPENDED') {
      throw new UnauthorizedException('This clinic account has been suspended.');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials.');
    }

    // Successful login — reset failed attempts
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const authorizedBranches = user.userBranches.map((ub) => ({
      id: ub.branch.id,
      name: ub.branch.name,
    }));

    let resolvedBpId: string | null = null;
    if (user.clinicId) {
      const bp = await this.prisma.businessPartner.findFirst({
        where: { clinicId: user.clinicId, linkedUserId: user.id, isActive: true },
        select: { id: true },
      });
      if (bp) resolvedBpId = bp.id;
    }

    const userContext: UserContext = {
      userId: user.id,
      clinicId: user.clinicId ?? null,
      clinicName: user.clinic?.name ?? null,
      clinicSlug: user.clinic?.slug ?? null,
      role: user.role as unknown as Role,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      preferredLocale: (user.preferredLocale as unknown as Locale) ?? Locale.TH,
      authorizedBranches,
      businessPartnerId: resolvedBpId,
      currencyCode: user.clinic?.currencyCode ?? 'THB',
    };

    const sessionId = await this.sessions.createSession(userContext);

    this.logger.log(`Login: userId=${user.id} role=${user.role} ip=${ipAddress ?? 'unknown'}`);

    const profile: AuthProfile = {
      id: user.id,
      name: user.name ?? undefined,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      role: user.role as unknown as Role,
      clinicName: user.clinic?.name ?? null,
      clinicSlug: user.clinic?.slug ?? null,
      branches: authorizedBranches,
      preferredLocale: (user.preferredLocale as unknown as Locale) ?? Locale.TH,
      businessPartnerId: resolvedBpId,
      currencyCode: user.clinic?.currencyCode ?? 'THB',
    };

    return { sessionId, profile };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.deleteSession(sessionId);
  }

  /**
   * US6: Force-change password for mustChangePassword users, or voluntary
   * password change for active staff members.
   */
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found.');

    if (!user.mustChangePassword) {
      if (!currentPassword) throw new UnauthorizedException('Current password is required.');
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) throw new UnauthorizedException('Current password is incorrect.');
    }

    assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, status: 'ACTIVE' as any },
    });
  }

  private async handleFailedLogin(user: { id: string; failedLoginAttempts: number; clinic?: { settings: unknown } | null }): Promise<void> {
    const settings = (user.clinic?.settings as Record<string, number> | null) ?? {};
    const maxAttempts: number = settings['max_login_attempts'] ?? 5;
    const lockoutMinutes: number = settings['lockout_duration_minutes'] ?? 15;

    const newAttempts = user.failedLoginAttempts + 1;

    if (newAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          status: UserStatus.LOCKED as any,
          lockedUntil,
        },
      });
      this.logger.warn(`Account locked: userId=${user.id} until=${lockedUntil.toISOString()}`);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: newAttempts },
      });
    }
  }
}
