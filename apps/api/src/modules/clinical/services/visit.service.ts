import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types } from 'mongoose';
import { IVisitRecord, MODEL_NAMES } from '@petiatrics/database';
import { withClinic } from '@petiatrics/database';
import { VisitFinalizedEvent } from '../../../common/events/domain-events';
import { StockService } from '../../inventory/services/stock.service';

export interface CreateVisitDto {
  patientId: string;
  vetId: string;
  branchId: string;
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
  private readonly logger = new Logger(VisitService.name);

  constructor(
    @InjectModel(MODEL_NAMES.VISIT_RECORD)
    private readonly visitModel: Model<IVisitRecord>,
    private readonly events: EventEmitter2,
    private readonly stockService: StockService,
  ) {}

  async create(clinicId: string, dto: CreateVisitDto): Promise<IVisitRecord> {
    const doc = new this.visitModel({
      clinicId,
      branchId: dto.branchId,
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

  async finalize(clinicId: string, visitId: string, vetId: string, branchId: string): Promise<IVisitRecord> {
    const visit = await this.getOne(clinicId, visitId);
    if (visit.status !== 'draft') {
      throw new BadRequestException('Visit is not in draft status.');
    }

    visit.status = 'finalized';
    visit.finalizedAt = new Date();
    const saved = await visit.save();

    // Synchronously deduct inventory for each inventory-linked prescription
    const linkedPrescriptions = (visit.prescriptions ?? [])
      .filter((p) => p.inventoryLinked && p.productId)
      .map((p) => ({ productId: p.productId!, quantity: (p as { quantity?: number }).quantity ?? 1 }));

    const deducted: string[] = [];
    try {
      for (const item of linkedPrescriptions) {
        await this.stockService.deduct(clinicId, {
          branchId,
          productId: item.productId,
          quantity: item.quantity,
          visitRecordId: visitId,
          actorId: vetId,
          idempotencyKey: `visit:${visitId}:${item.productId}`,
        });
        deducted.push(item.productId);
      }
    } catch (err: unknown) {
      // Compensate already-deducted items, then rethrow
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Stock deduction failed during visit finalization ${visitId}: ${msg}. Compensating ${deducted.length} item(s).`);
      for (const productId of deducted) {
        try {
          await this.stockService.replenish(clinicId, { branchId, productId, quantity: 1, referenceId: `compensation:visit:${visitId}`, actorId: vetId });
        } catch (compErr) {
          this.logger.error(`Failed to compensate stock for product ${productId}: ${String(compErr)}`);
        }
      }
      throw new BadRequestException(`Failed to deduct stock during finalization: ${msg}`);
    }

    const productIds = linkedPrescriptions.map((p) => p.productId);
    this.events.emit(
      'visit.finalized',
      new VisitFinalizedEvent(
        clinicId,
        visitId,
        visit.patientId.toString(),
        vetId,
        branchId,
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
