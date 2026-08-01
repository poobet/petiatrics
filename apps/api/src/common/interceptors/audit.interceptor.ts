import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request } from 'express';
import type { UserContext } from '@petiatrics/types';
import { AuditOperation } from '@petiatrics/types';

// ─── Decorator ───────────────────────────────────────────────────────────────

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  /** The Mongoose/Prisma collection or resource name, e.g. 'visit_records' */
  entity: string;
  /** The operation performed (maps to AuditOperation enum in the schema) */
  operation: `${AuditOperation}` | AuditOperation;
  /**
   * Optional function that extracts the entity ID from the response payload.
   * Defaults to `(result) => result?.id ?? result?._id?.toString()`.
   */
  resolveEntityId?: (result: unknown) => string | undefined;
}

/**
 * Attach audit metadata to a controller handler.
 *
 * @example
 *   @Audit({ entity: 'visit_records', operation: 'create' })
 *   @Post()
 *   create(...) {}
 */
export const Audit = (meta: AuditMetadata) => SetMetadata(AUDIT_KEY, meta);

// ─── Interceptor ─────────────────────────────────────────────────────────────

/**
 * AuditInterceptor — emits an 'audit.log' event for every mutating operation
 * decorated with @Audit().  The AuditModule (Phase 9) listens for this event
 * and persists an immutable AuditLog document in MongoDB.
 *
 * It does NOT block the request — audit writes are fire-and-forget via the
 * event emitter so a failed audit write never takes down the API.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly events: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @Audit() decorator, pass through unchanged
    if (!auditMeta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<
      Request & { userContext?: UserContext }
    >();

    const userContext = request.userContext;

    return next.handle().pipe(
      tap({
        next: (result: unknown) => {
          if (!userContext) {
            this.logger.warn(
              `AuditInterceptor: no userContext on ${request.method} ${request.url}; skipping audit.`,
            );
            return;
          }

          const resolveId =
            auditMeta.resolveEntityId ??
            ((r: unknown) => {
              if (r && typeof r === 'object') {
                const obj = r as Record<string, unknown>;
                return (
                  (obj['id'] as string | undefined) ??
                  obj['_id']?.toString()
                );
              }
              return undefined;
            });

          const entityId = resolveId(result);

          // Emit fire-and-forget — subscribers persist to MongoDB
          this.events.emit('audit.log', {
            clinicId: userContext.clinicId,
            actorUserId: userContext.userId,
            actorEmail: userContext.email,
            actorRole: userContext.role,
            operation: auditMeta.operation,
            entity: auditMeta.entity,
            entityId: entityId ?? 'unknown',
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            timestamp: new Date(),
          });
        },
        error: () => {
          // Do not emit audit logs for failed operations
        },
      }),
    );
  }
}

// ─── Event payload type ───────────────────────────────────────────────────────

export interface AuditLogEvent {
  clinicId: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  operation: AuditMetadata['operation'];
  entity: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
