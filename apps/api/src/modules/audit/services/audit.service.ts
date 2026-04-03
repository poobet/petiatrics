import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAuditLog } from '@petiatrics/database';
import { MODEL_NAMES } from '@petiatrics/database';

export interface AuditQueryFilters {
  clinicId?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  operation?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(MODEL_NAMES.AUDIT_LOG)
    private readonly auditLogModel: Model<IAuditLog>,
  ) {}

  async query(filters: AuditQueryFilters) {
    const {
      clinicId,
      actorId,
      entityType,
      entityId,
      operation,
      from,
      to,
      page = 1,
      limit = 50,
    } = filters;

    const filter: Record<string, unknown> = {};

    if (clinicId !== undefined) {
      // Allow explicit null for platform-level entries
      filter['clinicId'] = clinicId;
    }
    if (actorId) filter['actorId'] = actorId;
    if (entityType) filter['entityType'] = entityType;
    if (entityId) filter['entityId'] = entityId;
    if (operation) filter['operation'] = operation;

    if (from || to) {
      filter['timestamp'] = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
