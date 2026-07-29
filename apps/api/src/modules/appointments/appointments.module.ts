import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppointmentService } from './services/appointment.service';
import { ReminderService } from './services/reminder.service';
import { AppointmentController } from './controllers/appointment.controller';

import { DocumentSequenceModule } from '../document-sequence/document-sequence.module';

/**
 * AppointmentsModule — US3: Appointment Scheduling
 *
 * Handles: appointment booking, per-vet overlap prevention, status lifecycle,
 * cancellation, 24-hour-before reminder polling.
 */
@Module({
  imports: [DocumentSequenceModule],
  controllers: [AppointmentController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    AppointmentService,
    ReminderService,
  ],
  exports: [AppointmentService],
})
export class AppointmentsModule {}
