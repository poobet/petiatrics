import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService, LoginDto } from '../services/auth.service';
import { ClinicService } from '../services/clinic.service';
import { RegisterRequestDto } from '../dto/register-request.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/tenant.decorator';
import type { UserContext, AuthProfile } from '@petiatrics/types';
import { SESSION_COOKIE } from '../../../common/session/session.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly clinics: ClinicService,
  ) {}

  /**
   * POST /api/v1/auth/register-request
   * Public endpoint — clinic self-registration. Creates PENDING clinic + owner.
   */
  @Public()
  @Post('register-request')
  @HttpCode(HttpStatus.CREATED)
  registerRequest(@Body() dto: RegisterRequestDto) {
    return this.clinics.registerRequest(dto);
  }

  /**
   * POST /api/v1/auth/login
   * Validates credentials (email or username@clinicSlug), creates session,
   * sets HttpOnly cookie. Returns AuthProfile.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthProfile> {
    const ipAddress = req.ip;
    const { sessionId, profile } = await this.auth.login(dto, ipAddress);

    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: parseInt(process.env.SESSION_TTL_SECONDS ?? '86400', 10) * 1000,
    });

    return profile;
  }

  /**
   * POST /api/v1/auth/logout
   * Destroys the session and clears the cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (sessionId) {
      await this.auth.logout(sessionId);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/', sameSite: 'strict', httpOnly: true });
  }

  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user as AuthProfile shape.
   */
  @Get('me')
  me(@CurrentUser() user: UserContext): AuthProfile {
    return {
      id: user.userId,
      email: user.email,
      username: user.username,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      clinicName: user.clinicName ?? null,
      clinicSlug: user.clinicSlug ?? null,
      branches: user.authorizedBranches ?? [],
      preferredLocale: user.preferredLocale,
      currencyCode: user.currencyCode ?? null,
    };
  }

  /**
   * POST /api/v1/auth/change-password
   * US6: Force-change password (mustChangePassword=true) or voluntary change.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: UserContext,
    @Body() body: { currentPassword?: string; newPassword: string },
  ): Promise<void> {
    await this.auth.changePassword(user.userId, body.currentPassword, body.newPassword);
  }
}
