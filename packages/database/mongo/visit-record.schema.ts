import { Schema, Document, model, models, Types } from 'mongoose';

export type VisitStatus = 'draft' | 'finalized' | 'amended';

export interface IPrescription {
  drug: string;
  dosage: string;
  frequency: string;
  duration: string;
  productId?: string | null; // UUID of matching Product in PostgreSQL (nullable = unlinked)
  inventoryLinked: boolean;
}

export interface IAttachment {
  type: 'lab_result' | 'imaging' | 'file';
  url: string;
}

export interface ISOAP {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface IVisitRecord extends Document {
  clinicId: string;
  branchId: string;
  patientId: Types.ObjectId;
  appointmentId?: string | null; // UUID of Appointment in PostgreSQL
  vetId: string; // UUID of User in PostgreSQL
  visitDate: Date;
  soap: ISOAP;
  prescriptions: IPrescription[];
  attachments: IAttachment[];
  status: VisitStatus;
  finalizedAt?: Date | null;
  amendedAt?: Date | null;
  amendedBy?: string | null;
  amendmentReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PrescriptionSchema = new Schema<IPrescription>(
  {
    drug: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    duration: { type: String, required: true },
    productId: { type: String, default: null },
    inventoryLinked: { type: Boolean, default: false },
  },
  { _id: false },
);

const AttachmentSchema = new Schema<IAttachment>(
  {
    type: { type: String, enum: ['lab_result', 'imaging', 'file'], required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

const SOAPSchema = new Schema<ISOAP>(
  {
    subjective: { type: String, default: '' },
    objective: { type: String, default: '' },
    assessment: { type: String, default: '' },
    plan: { type: String, default: '' },
  },
  { _id: false },
);

const VisitRecordSchema = new Schema<IVisitRecord>(
  {
    clinicId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, required: true, ref: 'PetProfile' },
    appointmentId: { type: String, default: null },
    vetId: { type: String, required: true },
    visitDate: { type: Date, required: true, default: Date.now },
    soap: { type: SOAPSchema, required: true, default: {} },
    prescriptions: { type: [PrescriptionSchema], default: [] },
    attachments: { type: [AttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'finalized', 'amended'],
      default: 'draft',
    },
    finalizedAt: { type: Date, default: null },
    amendedAt: { type: Date, default: null },
    amendedBy: { type: String, default: null },
    amendmentReason: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: 'visit_records',
  },
);

VisitRecordSchema.index({ clinicId: 1, patientId: 1 });
VisitRecordSchema.index({ clinicId: 1, vetId: 1 });
VisitRecordSchema.index({ clinicId: 1, status: 1 });

export { VisitRecordSchema };
export const VisitRecordModel =
  models['VisitRecord'] ?? model<IVisitRecord>('VisitRecord', VisitRecordSchema);
