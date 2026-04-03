import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPetProfile, MODEL_NAMES } from '@petiatrics/database';
import { withClinic } from '@petiatrics/database';

export interface CreatePatientDto {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: Date;
  sex?: string;
  color?: string;
  weightKg?: number;
  microchipNumber?: string;
  ownerUserId: string;
}

export type UpdatePatientDto = Partial<Omit<CreatePatientDto, 'ownerUserId'>>;

@Injectable()
export class PatientService {
  constructor(
    @InjectModel(MODEL_NAMES.PET_PROFILE)
    private readonly petProfileModel: Model<IPetProfile>,
  ) {}

  async create(clinicId: string, dto: CreatePatientDto): Promise<IPetProfile> {
    const doc = new this.petProfileModel({
      ...dto,
      clinicId,
      isActive: true,
      createdAt: new Date(),
    });
    return doc.save();
  }

  async findAll(clinicId: string, search?: string, ownerUserId?: string): Promise<IPetProfile[]> {
    const filter: Record<string, unknown> = withClinic(clinicId);
    if (search) {
      filter['name'] = { $regex: search, $options: 'i' };
    }
    if (ownerUserId) {
      filter['ownerUserId'] = ownerUserId;
    }
    return this.petProfileModel.find(filter).sort({ name: 1 }).exec();
  }

  async findById(clinicId: string, id: string): Promise<IPetProfile> {
    const doc = await this.petProfileModel
      .findOne({ _id: id, ...withClinic(clinicId) })
      .exec();
    if (!doc) throw new NotFoundException(`Patient ${id} not found.`);
    return doc;
  }

  async update(
    clinicId: string,
    id: string,
    dto: Partial<CreatePatientDto>,
  ): Promise<IPetProfile> {
    const doc = await this.petProfileModel
      .findOneAndUpdate(
        { _id: id, ...withClinic(clinicId) },
        { $set: dto },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException(`Patient ${id} not found.`);
    return doc;
  }
}
