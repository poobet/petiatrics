import { Schema, Document, model, models } from 'mongoose';

export interface IPetProfile extends Document {
  clinicId: string;
  ownerUserId: string;
  name: string;
  species: string;
  breed: string;
  dateOfBirth?: Date;
  weightKg?: number;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PetProfileSchema = new Schema<IPetProfile>(
  {
    clinicId: { type: String, required: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    species: { type: String, required: true },
    breed: { type: String, required: true },
    dateOfBirth: { type: Date },
    weightKg: { type: Number },
    photoUrl: { type: String },
  },
  {
    timestamps: true,
    collection: 'pet_profiles',
  },
);

// Compound index for clinic-scoped patient lookup
PetProfileSchema.index({ clinicId: 1, name: 1 });
PetProfileSchema.index({ clinicId: 1, ownerUserId: 1 });

export { PetProfileSchema };
export const PetProfileModel =
  models['PetProfile'] ?? model<IPetProfile>('PetProfile', PetProfileSchema);
