import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import { IVisitRecord, MODEL_NAMES } from '@petiatrics/database';
import { withClinic } from '@petiatrics/database';
import { VisitFinalizedEvent } from '../../../common/events/domain-events';

export interface CreateVisitDto {
  patientId: string;
  vetId: string;
  chiefComplaint: string;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  prescriptions?: Array<{
    drug: string;
    dosage: string;
    frequency: string;
    duration: string;
    productId?: string | null;
    inventoryLinked?: boolean;
  }>;
}

export interface UpdateVisitDto {
  chiefComplaint?: string;
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  prescriptions?: CreateVisitDto['prescriptions'];
}

export interface AmendVisitDto {
  amendmentReason: string;
  soap?: UpdateVisitDto['soap'];
  prescriptions?: CreateVisitDto['prescriptions'];
}

@Injectable()
export class VisitService {
  constructor(
    @InjectModel(MODEL_NAMES.VISIT_RECORD)
    private readonly visitModel: Model<IVisitRecord>,
    private readonly events: EventEmitter2,
  ) {}

  async create(clinicId: string, dto: CreateVisitDto): Promise<IVisitRecord> {
    const doc = new this.visitModel({
      clinicId,
      patientId: dto.patientId,
      vetId: dto.vetId,
      chiefComplaint: dto.chiefComplaint,
      soap: dto.soap ?? {},
      prescriptions: dto.prescriptions ?? [],
      attachments: [],
      status: 'draft',
      visitDate: new Date(),
    });
    return doc.save();
  }

  async update(
    clinicId: string,
    visitId: string,
    dto: UpdateVisitDto,
  ): Promise<IVisitRecord> {
    const visit = await this.getOne(clinicId, visitId);
    if (visit.status !== 'draft') {
      throw new BadRequestException('Only draft visits can be edited.');
    }
    Object.assign(visit, dto);
    return visit.save();
  }

  async finalize(clinicId: string, visitId: string, vetId: string): Promise<IVisitRecord> {
    const visit = await this.getOne(clinicId, visitId);
    if (visit.status !== 'draft') {
      throw new BadRequestException('Visit is not in draft status.');
    }

    visit.status = 'finalized';
    visit.finalizedAt = new Date();
    const saved = await visit.save();

    // Collect product IDs from inventory-linked prescriptions
    const productIds = (visit.prescriptions ?? [])
      .filter((p) => p.inventoryLinked && p.productId)
      .map((p) => p.productId!);

    this.events.emit(
      'visit.finalized',
      new VisitFinalizedEvent(
        clinicId,
        visitId,
        visit.patientId.toString(),
        vetId,
        saved.finalizedAt!,
        productIds,
      ),
    );

    return saved;
  }

  async amend(
    clinicId: string,
    visitId: string,
    vetId: string,
    dto: AmendVisitDto,
  ): Promise<IVisitRecord> {
    const visit = await this.getOne(clinicId, visitId);
    if (visit.status !== 'finalized') {
      throw new BadRequestException('Only finalized visits can be amended.');
    }

    visit.status = 'amended';
    visit.amendedAt = new Date();
    visit.amendedBy = vetId;
    visit.amendmentReason = dto.amendmentReason;
    if (dto.soap) visit.soap = { ...visit.soap, ...dto.soap } as IVisitRecord['soap'];
    if (dto.prescriptions) visit.prescriptions = dto.prescriptions as IVisitRecord['prescriptions'];

    return visit.save();
  }

  async findByPatient(clinicId: string, patientId: string): Promise<IVisitRecord[]> {
    return this.visitModel
      .find({ clinicId, patientId, ...withClinic(clinicId) })
      .sort({ visitDate: -1 })
      .exec();
  }

  async getOne(clinicId: string, visitId: string): Promise<IVisitRecord> {
    const doc = await this.visitModel
      .findOne({ _id: visitId, ...withClinic(clinicId) })
      .exec();
    if (!doc) throw new NotFoundException(`Visit ${visitId} not found.`);
    return doc;
  }
}
