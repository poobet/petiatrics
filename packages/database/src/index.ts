// ─── Model name constants ────────────────────────────────────────────────────
export { MODEL_NAMES } from './model-names';

// ─── Prisma ───────────────────────────────────────────────────────────────────
export { createPrismaClient, scopedPrisma } from './prisma-tenant';
export type { ScopedPrismaClient } from './prisma-tenant';

// ─── Mongoose ─────────────────────────────────────────────────────────────────
export { applyMongooseTenantMiddleware, withClinic, skipTenantFilter } from './mongo-tenant';

// ─── Mongoose Schemas ────────────────────────────────────────────────────────
export { PetProfileModel, PetProfileSchema } from '../mongo/pet-profile.schema';
export type { IPetProfile } from '../mongo/pet-profile.schema';

export { VisitRecordModel, VisitRecordSchema } from '../mongo/visit-record.schema';
export type {
  IVisitRecord,
  IPrescription,
  IAttachment,
  ISOAP,
  VisitStatus,
} from '../mongo/visit-record.schema';

export { VaccinationRecordModel, VaccinationRecordSchema } from '../mongo/vaccination-record.schema';
export type { IVaccinationRecord } from '../mongo/vaccination-record.schema';

export { AuditLogModel, AuditLogSchema } from '../mongo/audit-log.schema';
export type { IAuditLog, AuditOperation } from '../mongo/audit-log.schema';
