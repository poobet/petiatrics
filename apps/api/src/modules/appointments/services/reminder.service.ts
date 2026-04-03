import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';

/**
 * ReminderService
 *
 * Listens for a cron-style periodic check or direct event and schedules
 * 24-hour-before appointment reminders. In this implementation it provides
 * the polling logic — a cron job calling `pollUpcomingReminders` should be
 * wired in when a task scheduler is available. For now, it logs upcoming
 * appointments and emits a `appointment.reminder.due` event per due appointment.
 *
 * Note: Full push/email delivery is wired in Phase 8 (US6 PWA push notifications).
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Query for appointments starting within the next 24–25 hours that are
   * CONFIRMED or REQUESTED and haven't been cancelled.
   * To be called by a scheduler (e.g., @Cron every 15 minutes).
   */
  async pollUpcomingReminders(): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60_000); // 23 h from now
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60_000);   // 25 h from now

    const due = await this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        status: { in: ['REQUESTED', 'CONFIRMED'] as any[] },
      },
      select: {
        id: true,
        clinicId: true,
        ownerUserId: true,
        vetUserId: true,
        scheduledAt: true,
        reason: true,
      },
    });

    for (const appt of due) {
      this.logger.log(
        `Reminder due: appointment ${appt.id} at ${appt.scheduledAt.toISOString()} ` +
        `for owner ${appt.ownerUserId} in clinic ${appt.clinicId}`,
      );
      // TODO (Phase 8): emit push notification event
    }
  }
}
