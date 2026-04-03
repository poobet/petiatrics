import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopedPrisma } from '@petiatrics/database';
import { intervalsOverlap, appointmentEnd } from '../utils/overlap-detection.util';

export interface CreateAppointmentDto {
  patientId: string;
  ownerUserId: string;
  vetUserId?: string;
  scheduledAt: Date;
  durationMinutes: number;
  reason: string;
}

export interface UpdateStatusDto {
  status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  cancellationReason?: string;
}

@Injectable()
export class AppointmentService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(clinicId: string, dto: CreateAppointmentDto) {
    // Per-vet overlap detection
    if (dto.vetUserId) {
      await this.assertNoVetOverlap(
        clinicId,
        dto.vetUserId,
        new Date(dto.scheduledAt),
        dto.durationMinutes,
      );
    }

    const db = scopedPrisma(this.prisma, clinicId);
    return db.appointment.create({
      data: {
        clinicId,
        patientId: dto.patientId,
        ownerUserId: dto.ownerUserId,
        vetUserId: dto.vetUserId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        reason: dto.reason,
      },
    });
  }

  async findAll(
    clinicId: string,
    params: { date?: string; vetUserId?: string } = {},
  ) {
    const db = scopedPrisma(this.prisma, clinicId);
    const where: Record<string, unknown> = {};

    if (params.vetUserId) where['vetUserId'] = params.vetUserId;
    if (params.date) {
      const day = new Date(params.date);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      where['scheduledAt'] = { gte: day, lt: next };
    }

    return db.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findById(clinicId: string, id: string) {
    const db = scopedPrisma(this.prisma, clinicId);
    const appt = await db.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException(`Appointment ${id} not found.`);
    return appt;
  }

  async updateStatus(clinicId: string, id: string, dto: UpdateStatusDto) {
    await this.findById(clinicId, id); // ensure exists + scoped
    const db = scopedPrisma(this.prisma, clinicId);
    return db.appointment.update({
      where: { id },
      data: {
        status: dto.status as any,
        cancellationReason: dto.cancellationReason,
      },
    });
  }

  async cancel(clinicId: string, id: string, reason: string) {
    return this.updateStatus(clinicId, id, {
      status: 'CANCELLED',
      cancellationReason: reason,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async assertNoVetOverlap(
    clinicId: string,
    vetUserId: string,
    newStart: Date,
    durationMinutes: number,
  ): Promise<void> {
    const db = scopedPrisma(this.prisma, clinicId);
    const newEnd = appointmentEnd(newStart, durationMinutes);

    // Load any non-cancelled vet appointments in a wide window around the new slot
    const windowStart = new Date(newStart.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(newEnd.getTime() + 24 * 60 * 60_000);

    const existing = await db.appointment.findMany({
      where: {
        vetUserId,
        status: { not: 'CANCELLED' as any },
        scheduledAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });

    for (const appt of existing) {
      const existStart = new Date(appt.scheduledAt);
      const existEnd = appointmentEnd(existStart, appt.durationMinutes);
      if (intervalsOverlap(newStart, newEnd, existStart, existEnd)) {
        throw new BadRequestException(
          `Vet has an overlapping appointment at ${existStart.toISOString()}.`,
        );
      }
    }
  }
}
