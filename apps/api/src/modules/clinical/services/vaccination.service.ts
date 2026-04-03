import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IVaccinationRecord, MODEL_NAMES } from '@petiatrics/database';
import { withClinic } from '@petiatrics/database';

export interface CreateVaccinationDto {
  patientId: string;
  vaccineName: string;
  batchNumber?: string;
  administeredAt: Date;
  nextDueAt?: Date;
  vetId: string;
}

@Injectable()
export class VaccinationService {
  constructor(
    @InjectModel(MODEL_NAMES.VACCINATION_RECORD)
    private readonly vaccinationModel: Model<IVaccinationRecord>,
  ) {}

  async create(clinicId: string, dto: CreateVaccinationDto): Promise<IVaccinationRecord> {
    const doc = new this.vaccinationModel({ clinicId, ...dto });
    return doc.save();
  }

  async listByPatient(
    clinicId: string,
    patientId: string,
  ): Promise<IVaccinationRecord[]> {
    return this.vaccinationModel
      .find({ ...withClinic(clinicId), patientId })
      .sort({ administeredAt: -1 })
      .exec();
  }

  async getOne(clinicId: string, id: string): Promise<IVaccinationRecord> {
    const doc = await this.vaccinationModel
      .findOne({ _id: id, ...withClinic(clinicId) })
      .exec();
    if (!doc) throw new NotFoundException(`Vaccination record ${id} not found.`);
    return doc;
  }
}
