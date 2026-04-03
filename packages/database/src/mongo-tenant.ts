import mongoose from 'mongoose';

/**
 * Applies global Mongoose query middleware that enforces clinic_id tenant scoping
 * on all find, findOne, update, and delete operations.
 *
 * Call this once during application bootstrap BEFORE any models are registered.
 * The middleware injects `clinicId` into the query filter when a `_tenantClinicId`
 * option is set on the query object (set by the NestJS repository layer).
 *
 * Usage in NestJS services via a typed query helper:
 *   Model.find().setOptions({ _tenantClinicId: clinicId })
 *
 * Models that are NOT tenant-scoped (e.g. AuditLog used by Platform Admin)
 * must explicitly pass `_skipTenantFilter: true` in query options.
 */
export function applyMongooseTenantMiddleware() {
  const tenantScopedCollections = ['pet_profiles', 'visit_records', 'vaccination_records'];

  function injectClinicId(this: mongoose.Query<unknown, unknown>) {
    const options = this.getOptions() as {
      _tenantClinicId?: string;
      _skipTenantFilter?: boolean;
    };

    if (options._skipTenantFilter) return;

    const collection = this.model.collection.collectionName;
    if (!tenantScopedCollections.includes(collection)) return;

    if (options._tenantClinicId) {
      const existing = this.getFilter() as Record<string, unknown>;
      if (!existing['clinicId']) {
        this.where({ clinicId: options._tenantClinicId });
      }
    }
  }

  // Apply pre-hooks to all read and write query operations
  const queryMethods = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
    'estimatedDocumentCount',
  ] as const;

  for (const method of queryMethods) {
    mongoose.plugin((schema: mongoose.Schema) => {
      schema.pre(method, injectClinicId);
    });
  }
}

/**
 * Helper to build a typed query options object with tenant context.
 */
export function withClinic(clinicId: string) {
  return { _tenantClinicId: clinicId };
}

/**
 * Helper to bypass tenant filtering for platform-admin queries.
 */
export const skipTenantFilter = { _skipTenantFilter: true };
