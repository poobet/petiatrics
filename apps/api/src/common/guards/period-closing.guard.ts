import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CHECK_PERIOD_FIELD_KEY } from '../decorators/check-period-field.decorator';

@Injectable()
export class PeriodClosingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const fieldName = this.reflector.getAllAndOverride<string>(
      CHECK_PERIOD_FIELD_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!fieldName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const body = request.body || {};

    const rawDate = body[fieldName] || new Date();
    const targetDate = new Date(rawDate);

    if (isNaN(targetDate.getTime())) {
      return true; // Let DTO validation handle invalid date
    }

    const clinicId =
      request.headers?.['x-tenant-id'] ||
      request.userContext?.clinicId ||
      request.params?.clinicId;

    if (!clinicId) {
      return true;
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1; // 1-12

    const period = await this.prisma.accountingPeriod.findUnique({
      where: {
        clinicId_year_month: {
          clinicId,
          year,
          month,
        },
      },
    });

    if (period && period.status === 'CLOSED') {
      const closedDateStr = period.closedAt
        ? period.closedAt.toISOString().split('T')[0]
        : 'unknown date';
      throw new ForbiddenException(
        `Transaction date falls within closed accounting period (${year}-${String(
          month,
        ).padStart(2, '0')}). Period was closed on ${closedDateStr}.`,
      );
    }

    return true;
  }
}
