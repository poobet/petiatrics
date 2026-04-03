import { Schema, Document, model, models, Types } from 'mongoose';

export interface IVaccinationRecord extends Document {
  clinicId: string;
  patientId: Types.ObjectId;
  vaccineName: string;
  administeredAt: Date;
  nextDueAt?: Date | null;
  batchNumber?: string | null;
  vetId: string;
  createdAt: Date;
  updatedAt: Date;
}

const VaccinationRecordSchema = new Schema<IVaccinationRecord>(
  {
    clinicId: { type: String, required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, required: true, ref: 'PetProfile' },
    vaccineName: { type: String, required: true },
    administeredAt: { type: Date, required: true },
    nextDueAt: { type: Date, default: null },
    batchNumber: { type: String, default: null },
    vetId: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'vaccination_records',
  },
);

VaccinationRecordSchema.index({ clinicId: 1, patientId: 1 });
VaccinationRecordSchema.index({ clinicId: 1, nextDueAt: 1 });

export { VaccinationRecordSchema };
export const VaccinationRecordModel =
  models['VaccinationRecord'] ??
  model<IVaccinationRecord>('VaccinationRecord', VaccinationRecordSchema);
