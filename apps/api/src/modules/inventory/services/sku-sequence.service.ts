import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * SkuSequenceService
 *
 * Generates a clinic-scoped, zero-padded SKU string (e.g. "SKU-00042").
 * Uses a SELECT … FOR UPDATE + UPDATE pattern to safely increment the
 * per-clinic sequence counter without double-issuing numbers under
 * concurrent requests.
 */
@Injectable()
export class SkuSequenceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns the next SKU string for the given clinic and bumps the counter.
   * Runs inside an interactive transaction so the row-level lock is released
   * before the caller's outer transaction (if any) commits.
   */
  async nextSku(clinicId: string): Promise<string> {
    const seq = await this.prisma.$transaction(async (tx) => {
      // Upsert to ensure the row exists on first call, then lock + increment.
      const existing = await tx.$queryRaw<{ nextVal: number }[]>`
        INSERT INTO clinic_item_sequences ("clinicId", "nextVal", "updatedAt")
        VALUES (${clinicId}, 1, NOW())
        ON CONFLICT ("clinicId")
        DO UPDATE SET "nextVal" = clinic_item_sequences."nextVal" + 1,
                      "updatedAt" = NOW()
        RETURNING "nextVal"
      `;
      return existing[0].nextVal;
    });

    return `SKU-${String(seq).padStart(5, '0')}`;
  }
}
