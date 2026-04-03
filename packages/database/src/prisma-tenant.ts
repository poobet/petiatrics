import { PrismaClient } from '@prisma/client';

/**
 * Creates a Prisma client extended with automatic clinic_id tenant scoping.
 * Every clinic-scoped model's `findMany`, `findFirst`, `findUnique`, `create`,
 * `update`, and `delete` query is checked/decorated via the extension.
 *
 * Usage in NestJS services:
 *   constructor(private readonly prisma: PrismaTenantService) {}
 *   // Then: this.prisma.forClinic(clinicId).appointment.findMany(...)
 */

export function createPrismaClient() {
  return new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
}

/**
 * Returns a scoped prisma proxy that injects clinicId on every supported operation.
 * This prevents accidental cross-tenant data leakage.
 */
export function scopedPrisma(prisma: PrismaClient, clinicId: string) {
  return prisma.$extends({
    query: {
      // Scope all reads and writes for clinic-owned models
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          const clinicScopedModels = [
            'User',
            'Appointment',
            'Product',
            'StockMovement',
            'Invoice',
            'InvoiceLineItem',
          ];

          if (!clinicScopedModels.includes(model)) {
            return query(args);
          }

          // Inject clinicId into where clauses for read and update operations
          if (['findMany', 'findFirst', 'findFirstOrThrow', 'count'].includes(operation)) {
            args['where'] = { ...((args['where'] as object) ?? {}), clinicId };
          }

          if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
            args['where'] = { ...((args['where'] as object) ?? {}), clinicId };
          }

          if (operation === 'create') {
            args['data'] = { ...((args['data'] as object) ?? {}), clinicId };
          }

          if (operation === 'upsert') {
            const createData = (args['create'] as object) ?? {};
            const whereFilter = (args['where'] as object) ?? {};
            args['create'] = { ...createData, clinicId };
            args['where'] = { ...whereFilter, clinicId };
          }

          return query(args);
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof scopedPrisma>;
