import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { SessionService } from './session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const SESSION_COOKIE = 'petiatrics_sid';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { userContext?: unknown }>();
    const sessionId = request.cookies?.[SESSION_COOKIE] as string | undefined;

    if (!sessionId) {
      throw new UnauthorizedException('No session found');
    }

    const userContext = await this.sessions.getSession(sessionId);
    if (!userContext) {
      const response = context.switchToHttp().getResponse<Response>();
      response.clearCookie(SESSION_COOKIE);
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Attach user context to request for downstream use
    request.userContext = userContext;

    // Refresh session TTL on active use
    await this.sessions.refreshSession(sessionId);

    return true;
  }
}
