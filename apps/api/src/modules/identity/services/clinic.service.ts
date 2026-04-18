import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Clinic } from '@prisma/client';
import { ClinicStatus, SubscriptionTier, UserStatus } from '@petiatrics/types';

const BCRYPT_ROUNDS = 12;

function assertPasswordPolicy(password: string): void {
  if (password.length < 8) throw new ConflictException('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) throw new ConflictException('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password)) throw new ConflictException('Password must contain at least one digit.');
}

export interface CreateClinicDto {
  name: string;
  taxId: string;
  address: Record<string, string>;
  subscriptionTier?: SubscriptionTier;
}

export interface UpdateClinicStatusDto {
  status: ClinicStatus;
}

export interface RegisterRequestDto {
  clinicName: string;
  taxId: string;
  address?: Record<string, string>;
  phone?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

@Injectable()
export class ClinicService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Build a URL-safe slug from a clinic name. */
  private buildSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  }

  /** Retry slug generation with numeric suffixes to handle collisions. */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = this.buildSlug(name);
    let slug = base;
    let attempt = 0;
    for (;;) {
      const existing = await this.prisma.clinic.findUnique({ where: { slug } });
      if (!existing) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }

  async create(dto: CreateClinicDto): Promise<Clinic> {
    const existing = await this.prisma.clinic.findFirst({
      where: { taxId: dto.taxId },
    });
    if (existing) {
      throw new ConflictException(`Clinic with Tax ID ${dto.taxId} already exists.`);
    }
    const slug = await this.generateUniqueSlug(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: dto.name,
          taxId: dto.taxId,
          slug,
          address: dto.address,
          subscriptionTier: dto.subscriptionTier ?? SubscriptionTier.FREE,
          status: ClinicStatus.ACTIVE,
        },
      });
      await tx.bpGroup.createMany({
        data: [
          { clinicId: clinic.id, name: 'Customers', prefix: 'C-' },
          { clinicId: clinic.id, name: 'Vets',      prefix: 'V-' },
          { clinicId: clinic.id, name: 'Suppliers', prefix: 'S-' },
        ],
      });
      return clinic;
    });
  }

  /**
   * US1: Self-service clinic registration. Creates a PENDING clinic and a
   * PENDING owner user atomically. Returns their IDs for confirmation.
   */
  async registerRequest(dto: RegisterRequestDto): Promise<{ clinicId: string; ownerId: string }> {
    const emailNorm = dto.ownerEmail.toLowerCase().trim();

    const [existingClinic, existingUser] = await Promise.all([
      this.prisma.clinic.findFirst({ where: { taxId: dto.taxId } }),
      this.prisma.user.findFirst({ where: { email: emailNorm } }),
    ]);
    if (existingClinic) throw new ConflictException('A clinic with this Tax ID already exists.');
    if (existingUser) throw new ConflictException('An account with this email already exists.');

    assertPasswordPolicy(dto.ownerPassword);

    const slug = await this.generateUniqueSlug(dto.clinicName);
    const passwordHash = await bcrypt.hash(dto.ownerPassword, BCRYPT_ROUNDS);

    const [clinic, owner] = await this.prisma.$transaction(async (tx) => {
      const c = await tx.clinic.create({
        data: {
          name: dto.clinicName,
          taxId: dto.taxId,
          slug,
          phone: dto.phone,
          address: dto.address ?? {},
          subscriptionTier: SubscriptionTier.FREE,
          status: ClinicStatus.PENDING,
          settings: {
            max_login_attempts: 5,
            lockout_duration_minutes: 15,
            password_min_length: 8,
            password_require_uppercase: true,
            password_require_number: true,
          },
        },
      });
      await tx.bpGroup.createMany({
        data: [
          { clinicId: c.id, name: 'Customers', prefix: 'C-' },
          { clinicId: c.id, name: 'Vets',      prefix: 'V-' },
          { clinicId: c.id, name: 'Suppliers', prefix: 'S-' },
        ],
      });
      const u = await tx.user.create({
        data: {
          email: emailNorm,
          name: dto.ownerName,
          passwordHash,
          role: 'CLINIC_OWNER',
          status: 'PENDING' as any,
          clinicId: c.id,
        },
      });
      return [c, u] as const;
    });

    return { clinicId: clinic.id, ownerId: owner.id };
  }

  /**
   * US2: Admin approves a PENDING clinic.
   * Sets clinic → ACTIVE and all PENDING users in that clinic → ACTIVE.
   */
  async approve(clinicId: string): Promise<Clinic> {
    const clinic = await this.findById(clinicId);
    if (clinic.status !== ClinicStatus.PENDING) {
      throw new ConflictException('Clinic is not in PENDING status.');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.clinic.update({
        where: { id: clinicId },
        data: { status: ClinicStatus.ACTIVE },
      }),
      this.prisma.user.updateMany({
        where: { clinicId, status: 'PENDING' as any },
        data: { status: 'ACTIVE' as any },
      }),
    ]);
    return updated;
  }

  /**
   * US2: Admin rejects a PENDING clinic.
   * Sets clinic → REJECTED and all PENDING users → INACTIVE.
   */
  async reject(clinicId: string, reason?: string): Promise<Clinic> {
    const clinic = await this.findById(clinicId);
    if (clinic.status !== ClinicStatus.PENDING) {
      throw new ConflictException('Clinic is not in PENDING status.');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.clinic.update({
        where: { id: clinicId },
        data: { status: ClinicStatus.REJECTED },
      }),
      this.prisma.user.updateMany({
        where: { clinicId, status: 'PENDING' as any },
        data: { status: 'INACTIVE' as any },
      }),
    ]);
    return updated;
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
    await this.findById(id);
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

