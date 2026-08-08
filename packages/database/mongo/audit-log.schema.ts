import mongoose from 'mongoose';

export type AuditOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'void'
  | 'amend'
  | 'status_change'
  | 'password_reset'
  | 'close'
  | 'reopen'
  | 'create_credit_note'
  | 'create_debit_note'
  | 'create_adjustment';

export interface IAuditLog extends mongoose.Document {
  clinicId?: string | null; // null for platform-level entries
  entityType: string;
  entityId: string;
  operation: AuditOperation;
  actorId: string;
  actorRole: string;
  timestamp: Date;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

const AuditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    clinicId: { type: String, default: null, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true },
    operation: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'void',
        'amend',
        'status_change',
        'password_reset',
        'close',
        'reopen',
        'create_credit_note',
        'create_debit_note',
        'create_adjustment',
      ],
      required: true,
    },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    beforeState: { type: mongoose.Schema.Types.Mixed, default: null },
    afterState: { type: mongoose.Schema.Types.Mixed, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    // No timestamps: true — we use an explicit `timestamp` field for immutability clarity
    collection: 'audit_logs',
    // Disable all update/remove hooks to reinforce append-only constraint at the schema level
    autoIndex: true,
  },
);

AuditLogSchema.index({ clinicId: 1, timestamp: -1 });
AuditLogSchema.index({ clinicId: 1, entityType: 1, entityId: 1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });

// Append-only enforcement: block any update or delete at the model level
AuditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function () {
  throw new Error('AuditLog entries are immutable and cannot be updated.');
});

AuditLogSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], function () {
  throw new Error('AuditLog entries are immutable and cannot be deleted.');
});

export const AuditLogModel =
  mongoose.models['AuditLog'] ?? mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export { AuditLogSchema };
