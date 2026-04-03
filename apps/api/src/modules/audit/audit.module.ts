import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MODEL_NAMES, AuditLogSchema } from '@petiatrics/database';
import { AuditService } from './services/audit.service';
import { AuditController } from './controllers/audit.controller';

/**
 * AuditModule — US7: Audit Logging & Compliance
 *
 * Handles: append-only audit log reads (MongoDB audit_logs collection),
 * filtering by operation/actor/entity, date-range pagination.
 * Logs are written by AuditInterceptor (T034) — this module provides
 * query/reporting endpoints for clinic admins and platform admins.
 *
 * Immutability is enforced at the Mongoose schema level via pre-hooks
 * that reject all update and delete operations.
 *
 * Implemented in Phase 9 (T101–T106).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MODEL_NAMES.AUDIT_LOG, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
