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

export interface LoginDto {
  email: string;
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
    const { email, password } = dto;

    // Lookup user with clinic and branches in a single query (avoids N+1)
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: {
        clinic: { select: { id: true, name: true, status: true, settings: true } },
        userBranches: {
          include: { branch: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
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
        data: { status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null },
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

    const userContext: UserContext = {
      userId: user.id,
      clinicId: user.clinicId ?? null,
      clinicName: user.clinic?.name ?? null,
      role: user.role as unknown as Role,
      email: user.email,
      preferredLocale: (user.preferredLocale as unknown as Locale) ?? Locale.TH,
      authorizedBranches,
    };

    const sessionId = await this.sessions.createSession(userContext);

    this.logger.log(`Login: userId=${user.id} role=${user.role} ip=${ipAddress ?? 'unknown'}`);

    const profile: AuthProfile = {
      id: user.id,
      email: user.email,
      role: user.role as unknown as Role,
      clinicName: user.clinic?.name ?? null,
      branches: authorizedBranches,
      preferredLocale: (user.preferredLocale as unknown as Locale) ?? Locale.TH,
    };

    return { sessionId, profile };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.deleteSession(sessionId);
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
          status: UserStatus.LOCKED,
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
