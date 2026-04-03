import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, Clinic } from '@prisma/client';
import { ClinicStatus, SubscriptionTier } from '@petiatrics/types';

export interface CreateClinicDto {
  name: string;
  taxId: string;
  address: Record<string, string>;
  subscriptionTier?: SubscriptionTier;
}

export interface UpdateClinicStatusDto {
  status: ClinicStatus;
}

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateClinicDto): Promise<Clinic> {
    const existing = await this.prisma.clinic.findFirst({
      where: { taxId: dto.taxId },
    });
    if (existing) {
      throw new ConflictException(`Clinic with Tax ID ${dto.taxId} already exists.`);
    }

    return this.prisma.clinic.create({
      data: {
        name: dto.name,
        taxId: dto.taxId,
        address: dto.address,
        subscriptionTier: dto.subscriptionTier ?? SubscriptionTier.FREE,
        status: ClinicStatus.ACTIVE,
      },
    });
  }

  async findAll(): Promise<Clinic[]> {
    return this.prisma.clinic.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string): Promise<Clinic> {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) throw new NotFoundException(`Clinic ${id} not found.`);
    return clinic;
  }

  async updateStatus(id: string, dto: UpdateClinicStatusDto): Promise<Clinic> {
    await this.findById(id); // ensure exists
    return this.prisma.clinic.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async getMetrics() {
    const [totalClinics, usersByClinic] = await this.prisma.$transaction([
      this.prisma.clinic.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
    ]);
    return { totalClinics, activeUsers: usersByClinic };
  }
}
