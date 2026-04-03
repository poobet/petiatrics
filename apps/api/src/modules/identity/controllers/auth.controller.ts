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
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/tenant.decorator';
import type { UserContext, AuthProfile } from '@petiatrics/types';
import { SESSION_COOKIE } from '../../../common/session/session.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Validates credentials, creates session, sets HttpOnly cookie.
   * Returns AuthProfile (id, email, role, clinicName, branches[]).
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

    // Set HttpOnly session cookie — strict to prevent CSRF
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
      role: user.role,
      clinicName: user.clinicName ?? null,
      branches: user.authorizedBranches ?? [],
      preferredLocale: user.preferredLocale,
    };
  }
}
