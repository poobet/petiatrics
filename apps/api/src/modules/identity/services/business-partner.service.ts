import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { BusinessPartnerResponse, ContactPositionResponse, TaxCodeResponse } from '@petiatrics/types';
import { BusinessPartnerType, BpRole } from '@petiatrics/types';
import { CreateBusinessPartnerDto } from '../dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto } from '../dto/update-business-partner.dto';
import { ListBusinessPartnersDto } from '../dto/list-business-partners.dto';

// ─── Helper: map a TaxCode row to the shared response shape ──────────────────

function mapTaxCode(tc: { id: string; code: string; description: string; rate: { toNumber(): number }; isVatType: boolean; isZeroRated: boolean; type: string } | null): TaxCodeResponse | null {
  if (!tc) return null;
  return {
    id: tc.id,
    code: tc.code,
    description: tc.description,
    rate: tc.rate.toNumber(),
    isVatType: tc.isVatType,
    isZeroRated: tc.isZeroRated,
    type: tc.type,
  };
}

function mapContactPosition(cp: { id: string; name: string } | null): ContactPositionResponse | null {
  if (!cp) return null;
  return { id: cp.id, name: cp.name };
}

// ─── Helper: map a full BP record to the shared response shape ───────────────
//
// VAT registration is INFERRED from defaultVatCode.isVatType.
// isVatRegistered is NOT persisted and must not appear in create/update payloads.
// Item-level VAT on invoices is driven by ItemMaster, not this BP default.

function mapBpToResponse(
  bp: Awaited<ReturnType<BusinessPartnerService['findByIdForManagement']>>,
): BusinessPartnerResponse {
  if (!bp) throw new NotFoundException('Business partner not found');

  const defaultVatCode = mapTaxCode(bp.defaultVatCode ?? null);
  const defaultWhtCode = mapTaxCode(bp.defaultWhtCode ?? null);

  return {
    id: bp.id,
    clinicId: bp.clinicId,
    type: bp.type as BusinessPartnerType,
    name: bp.name,
    // Thai compliance fields
    taxId: bp.taxId ?? null,
    isHeadOffice: bp.isHeadOffice,
    branchCode: bp.branchCode ?? null,
    addressLine1: bp.addressLine1 ?? null,
    subDistrict: bp.subDistrict ?? null,
    district: bp.district ?? null,
    province: bp.province ?? null,
    zipcode: bp.zipcode ?? null,
    // Hierarchy
    parentBpId: bp.parentBpId ?? null,
    // Tax defaults
    defaultVatCodeId: bp.defaultVatCodeId ?? null,
    defaultWhtCodeId: bp.defaultWhtCodeId ?? null,
    defaultVatCode,
    defaultWhtCode,
    // Inferred — never stored as a column
    isVatRegistered: defaultVatCode?.isVatType === true,
    // Payment defaults
    creditTermDays: bp.creditTermDays,
    // Communication
    phone: bp.phone ?? null,
    email: bp.email ?? null,
    lineId: bp.lineId ?? null,
    // Commercial
    creditLimit: bp.creditLimit ?? null,
    creditHold: bp.creditHold,
    discountGroupId: bp.discountGroupId ?? null,
    // Bank account
    bankAccountName: bp.bankAccountName ?? null,
    bankAccountBranch: bp.bankAccountBranch ?? null,
    bankAccountNumber: bp.bankAccountNumber ?? null,
    // Contacts
    contacts: ((bp as any).contacts ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      lineId: c.lineId ?? null,
      positionId: c.positionId ?? null,
      position: mapContactPosition(c.position ?? null),
      isPrimary: c.isPrimary,
    })),
    activeRoles: bp.activeRoles.map((r) => r.role as BpRole),
    isActive: bp.isActive,
    user: bp.user
      ? {
          id: bp.user.id,
          role: bp.user.role as string as import('@petiatrics/types').Role,
          email: bp.user.email,
          username: bp.user.username,
        }
      : null,
    vet: bp.vetExt
      ? { licenseNumber: bp.vetExt.licenseNumber }
      : null,
    supplier: bp.suppExt
      ? { vendorGroupId: bp.suppExt.vendorGroupId ?? null }
      : null,
    createdAt: bp.createdAt.toISOString(),
    updatedAt: bp.updatedAt.toISOString(),
  };
}

const BP_INCLUDE = {
  user: { select: { id: true, role: true, email: true, username: true } },
  vetExt: true,
  suppExt: true,
  activeRoles: true,
  defaultVatCode: true,
  defaultWhtCode: true,
  contacts: {
    include: { position: { select: { id: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }],
  },
};

@Injectable()
export class BusinessPartnerService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(clinicId: string, query: ListBusinessPartnersDto, callerIsManager: boolean): Promise<BusinessPartnerResponse[]> {
    const showInactive = callerIsManager && query.includeInactive === true;

    const bps = await this.prisma.businessPartner.findMany({
      where: {
        clinicId,
        ...(showInactive ? {} : { isActive: true }),
        ...(query.type ? { type: query.type as any } : {}),
        ...(query.search
          ? { name: { contains: query.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: BP_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return bps.map((bp) => mapBpToResponse(bp as any));
  }

  async findByIdForManagement(id: string, clinicId: string) {
    return this.prisma.businessPartner.findFirst({
      where: { id, clinicId },
      include: BP_INCLUDE,
    });
  }

  async getById(id: string, clinicId: string): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');
    return mapBpToResponse(bp as any);
  }

  async create(clinicId: string, dto: CreateBusinessPartnerDto): Promise<BusinessPartnerResponse> {
    // Validate clinic exists (guards against stale session after DB reset)
    const clinicExists = await this.prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
    if (!clinicExists) throw new BadRequestException('Clinic not found for this session — please log out and log back in');

    // Validate VET extension requirement
    if (dto.type === BusinessPartnerType.VET && !dto.vet?.licenseNumber) {
      throw new BadRequestException('licenseNumber is required for VET type');
    }

    // Validate license uniqueness
    if (dto.vet?.licenseNumber) {
      const existing = await this.prisma.bpVet.findUnique({
        where: { licenseNumber: dto.vet.licenseNumber },
      });
      if (existing) throw new ConflictException('Vet license number already exists');
    }

    // Validate global TaxCode references exist (TaxCode is not tenant-owned)
    if (dto.defaultVatCodeId) {
      await this.assertTaxCodeExists(dto.defaultVatCodeId, 'defaultVatCodeId');
    }
    if (dto.defaultWhtCodeId) {
      await this.assertTaxCodeExists(dto.defaultWhtCodeId, 'defaultWhtCodeId');
    }

    // Validate parentBpId belongs to the same clinic
    if (dto.parentBpId) {
      await this.assertParentBpSameClinic(dto.parentBpId, clinicId);
    }

    // Validate user linkage
    if (dto.linkUserId) {
      await this.assertUserLinkage(dto.linkUserId, clinicId);
    }

    // Validate contact position references
    if (dto.contacts) {
      const uniquePositionIds = [...new Set(
        dto.contacts.filter((c) => c.positionId).map((c) => c.positionId!),
      )];
      for (const pid of uniquePositionIds) {
        await this.assertContactPositionExists(pid);
      }
    }

    const bp = await this.prisma.$transaction(async (tx) => {
      const created = await tx.businessPartner.create({
        data: {
          clinicId,
          type: dto.type as any,
          name: dto.name,
          taxId: dto.taxId ?? null,
          isHeadOffice: dto.isHeadOffice ?? true,
          branchCode: dto.branchCode ?? null,
          addressLine1: dto.addressLine1 ?? null,
          subDistrict: dto.subDistrict ?? null,
          district: dto.district ?? null,
          province: dto.province ?? null,
          zipcode: dto.zipcode ?? null,
          parentBpId: dto.parentBpId ?? null,
          defaultVatCodeId: dto.defaultVatCodeId ?? null,
          defaultWhtCodeId: dto.defaultWhtCodeId ?? null,
          creditTermDays: dto.creditTermDays ?? 0,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          lineId: dto.lineId ?? null,
          creditLimit: dto.creditLimit ?? null,
          creditHold: dto.creditHold ?? false,
          discountGroupId: dto.discountGroupId ?? null,
          bankAccountName: dto.bankAccountName ?? null,
          bankAccountBranch: dto.bankAccountBranch ?? null,
          bankAccountNumber: dto.bankAccountNumber ?? null,
        },
        include: BP_INCLUDE,
      });

      // Persist active LN roles
      if (dto.activeRoles?.length) {
        await tx.bpRoleActive.createMany({
          data: dto.activeRoles.map((role) => ({ bpId: created.id, role: role as any })),
          skipDuplicates: true,
        });
      }

      if (dto.vet) {
        await tx.bpVet.create({
          data: {
            bpId: created.id,
            licenseNumber: dto.vet.licenseNumber,
          },
        });
      }

      if (dto.supplier) {
        await tx.bpSupplier.create({
          data: {
            bpId: created.id,
            vendorGroupId: dto.supplier.vendorGroupId ?? null,
          },
        });
      }

      // ── Contact persons ─────────────────────────────────────────────
      if (dto.contacts?.length) {
        const primaryIdx = dto.contacts.findIndex((c) => c.isPrimary);
        await tx.bpContact.createMany({
          data: dto.contacts.map((c, i) => ({
            bpId: created.id,
            name: c.name,
            phone: c.phone ?? null,
            email: c.email ?? null,
            lineId: c.lineId ?? null,
            positionId: c.positionId ?? null,
            isPrimary: primaryIdx === -1 ? false : i === primaryIdx,
          })),
        });
      }

      if (dto.linkUserId) {
        await tx.user.update({
          where: { id: dto.linkUserId },
          data: { businessPartnerId: created.id },
        });
      }

      return tx.businessPartner.findFirstOrThrow({
        where: { id: created.id },
        include: BP_INCLUDE,
      });
    });

    return mapBpToResponse(bp as any);
  }

  async update(id: string, clinicId: string, dto: UpdateBusinessPartnerDto): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');

    // Validate global TaxCode references
    if (dto.defaultVatCodeId !== undefined && dto.defaultVatCodeId !== null) {
      await this.assertTaxCodeExists(dto.defaultVatCodeId, 'defaultVatCodeId');
    }
    if (dto.defaultWhtCodeId !== undefined && dto.defaultWhtCodeId !== null) {
      await this.assertTaxCodeExists(dto.defaultWhtCodeId, 'defaultWhtCodeId');
    }

    // Validate parentBpId belongs to same clinic
    if (dto.parentBpId) {
      await this.assertParentBpSameClinic(dto.parentBpId, clinicId, id);
    }

    if (dto.linkUserId) {
      await this.assertUserLinkage(dto.linkUserId, clinicId, id);
    }

    // Validate contact position references
    if (dto.contacts) {
      const uniquePositionIds = [...new Set(
        dto.contacts.filter((c) => c.positionId).map((c) => c.positionId!),
      )];
      for (const pid of uniquePositionIds) {
        await this.assertContactPositionExists(pid);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Build core BP update payload — only include fields present in dto
      const coreUpdate: Record<string, unknown> = {};
      if (dto.name !== undefined) coreUpdate.name = dto.name;
      if (dto.taxId !== undefined) coreUpdate.taxId = dto.taxId;
      if (dto.isHeadOffice !== undefined) coreUpdate.isHeadOffice = dto.isHeadOffice;
      if (dto.branchCode !== undefined) coreUpdate.branchCode = dto.branchCode;
      if (dto.addressLine1 !== undefined) coreUpdate.addressLine1 = dto.addressLine1;
      if (dto.subDistrict !== undefined) coreUpdate.subDistrict = dto.subDistrict;
      if (dto.district !== undefined) coreUpdate.district = dto.district;
      if (dto.province !== undefined) coreUpdate.province = dto.province;
      if (dto.zipcode !== undefined) coreUpdate.zipcode = dto.zipcode;
      if (dto.parentBpId !== undefined) coreUpdate.parentBpId = dto.parentBpId;
      if (dto.defaultVatCodeId !== undefined) coreUpdate.defaultVatCodeId = dto.defaultVatCodeId;
      if (dto.defaultWhtCodeId !== undefined) coreUpdate.defaultWhtCodeId = dto.defaultWhtCodeId;
      if (dto.creditTermDays !== undefined) coreUpdate.creditTermDays = dto.creditTermDays;
      if (dto.phone !== undefined) coreUpdate.phone = dto.phone;
      if (dto.email !== undefined) coreUpdate.email = dto.email;
      if (dto.lineId !== undefined) coreUpdate.lineId = dto.lineId;
      if (dto.creditLimit !== undefined) coreUpdate.creditLimit = dto.creditLimit;
      if (dto.creditHold !== undefined) coreUpdate.creditHold = dto.creditHold;
      if (dto.discountGroupId !== undefined) coreUpdate.discountGroupId = dto.discountGroupId;
      if (dto.bankAccountName !== undefined) coreUpdate.bankAccountName = dto.bankAccountName;
      if (dto.bankAccountBranch !== undefined) coreUpdate.bankAccountBranch = dto.bankAccountBranch;
      if (dto.bankAccountNumber !== undefined) coreUpdate.bankAccountNumber = dto.bankAccountNumber;

      if (Object.keys(coreUpdate).length > 0) {
        await tx.businessPartner.update({ where: { id }, data: coreUpdate });
      }

      // Replace active LN roles atomically when provided
      if (dto.activeRoles !== undefined) {
        await tx.bpRoleActive.deleteMany({ where: { bpId: id } });
        if (dto.activeRoles.length > 0) {
          await tx.bpRoleActive.createMany({
            data: dto.activeRoles.map((role) => ({ bpId: id, role: role as any })),
            skipDuplicates: true,
          });
        }
      }

      if (dto.vet !== undefined) {
        if (dto.vet === null) {
          await tx.bpVet.deleteMany({ where: { bpId: id } });
        } else {
          await tx.bpVet.upsert({
            where: { bpId: id },
            create: { bpId: id, licenseNumber: dto.vet.licenseNumber },
            update: { licenseNumber: dto.vet.licenseNumber },
          });
        }
      }

      if (dto.supplier !== undefined) {
        if (dto.supplier === null) {
          await tx.bpSupplier.deleteMany({ where: { bpId: id } });
        } else {
          await tx.bpSupplier.upsert({
            where: { bpId: id },
            create: { bpId: id, vendorGroupId: dto.supplier.vendorGroupId ?? null },
            update: { vendorGroupId: dto.supplier.vendorGroupId ?? null },
          });
        }
      }

      // ── Contacts diff ────────────────────────────────────────────────────
      // Only runs when `contacts` is explicitly present (even if empty array).
      // Undefined → preserve existing contacts unchanged.
      if (dto.contacts !== undefined) {
        const existingContacts = await tx.bpContact.findMany({
          where: { bpId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingContacts.map((c) => c.id));
        const incomingIds = new Set(
          dto.contacts.filter((c) => c.id && existingIds.has(c.id)).map((c) => c.id!),
        );

        // Delete contacts absent from the incoming array
        const toDelete = existingContacts
          .filter((c) => !incomingIds.has(c.id))
          .map((c) => c.id);
        if (toDelete.length) {
          await tx.bpContact.deleteMany({ where: { id: { in: toDelete } } });
        }

        // Determine which contact is primary (first one flagged, or none)
        const primaryIdx = dto.contacts.findIndex((c) => c.isPrimary);

        // Upsert each incoming contact
        for (let i = 0; i < dto.contacts.length; i++) {
          const c = dto.contacts[i];
          const contactIsPrimary = primaryIdx === -1 ? false : i === primaryIdx;
          const isExisting = c.id && existingIds.has(c.id);
          if (isExisting) {
            await tx.bpContact.update({
              where: { id: c.id! },
              data: {
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                positionId: c.positionId ?? null,
                isPrimary: contactIsPrimary,
              },
            });
          } else {
            // New row — server generates a fresh UUID (c.id is discarded even if present)
            await tx.bpContact.create({
              data: {
                bpId: id,
                name: c.name,
                phone: c.phone ?? null,
                email: c.email ?? null,
                lineId: c.lineId ?? null,
                positionId: c.positionId ?? null,
                isPrimary: contactIsPrimary,
              },
            });
          }
        }
      }

      if (dto.linkUserId !== undefined) {
        // Unlink previous user if any
        if (bp.user) {
          await tx.user.update({
            where: { id: bp.user.id },
            data: { businessPartnerId: null },
          });
        }
        if (dto.linkUserId !== null) {
          await tx.user.update({
            where: { id: dto.linkUserId },
            data: { businessPartnerId: id },
          });
        }
      }

      return tx.businessPartner.findFirstOrThrow({
        where: { id },
        include: BP_INCLUDE,
      });
    });

    return mapBpToResponse(updated as any);
  }

  /**
   * Soft-delete a Business Partner by setting isActive = false.
   * Hard deletes are FORBIDDEN — BP data must be retained for referential integrity.
   */
  async deactivate(id: string, clinicId: string): Promise<BusinessPartnerResponse> {
    const bp = await this.findByIdForManagement(id, clinicId);
    if (!bp) throw new NotFoundException('Business partner not found');
    if (!bp.isActive) throw new BadRequestException('Business partner is already inactive');

    const updated = await this.prisma.businessPartner.update({
      where: { id },
      data: { isActive: false },
      include: BP_INCLUDE,
    });

    return mapBpToResponse(updated as any);
  }

  // ─── Private guards ─────────────────────────────────────────────────────────

  /** TaxCode is a global reference table — validate it exists without clinic scoping. */
  private async assertTaxCodeExists(taxCodeId: string, field: string): Promise<void> {
    const tc = await this.prisma.taxCode.findUnique({ where: { id: taxCodeId }, select: { id: true, isActive: true } });
    if (!tc) throw new BadRequestException(`${field}: TaxCode '${taxCodeId}' not found`);
    if (!tc.isActive) throw new BadRequestException(`${field}: TaxCode '${taxCodeId}' is inactive`);
  }

  /** Validate that a positionId references an active ContactPosition. */
  private async assertContactPositionExists(positionId: string): Promise<void> {
    const cp = await this.prisma.contactPosition.findUnique({
      where: { id: positionId },
      select: { id: true, isActive: true },
    });
    if (!cp || !cp.isActive) {
      throw new BadRequestException(`positionId '${positionId}' is not a valid active ContactPosition`);
    }
  }

  /** Return all active TaxCode records for use in VAT/WHT dropdown selectors. */
  async listTaxCodes(): Promise<TaxCodeResponse[]> {
    const rows = await this.prisma.taxCode.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { rate: 'asc' }],
    });
    return rows.map((tc) => mapTaxCode(tc)!);
  }

  /** Return all active ContactPosition records for use in the BpContact position selector. */
  async listContactPositions(): Promise<ContactPositionResponse[]> {
    const rows = await this.prisma.contactPosition.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((cp) => ({ id: cp.id, name: cp.name }));
  }

  /** parentBpId must reference a BP within the same clinic. */
  private async assertParentBpSameClinic(parentBpId: string, clinicId: string, currentId?: string): Promise<void> {
    if (currentId && parentBpId === currentId) {
      throw new BadRequestException('A Business Partner cannot be its own parent');
    }
    const parent = await this.prisma.businessPartner.findFirst({
      where: { id: parentBpId, clinicId },
      select: { id: true },
    });
    if (!parent) throw new BadRequestException('parentBpId must belong to the same clinic');
  }

  private async assertUserLinkage(userId: string, clinicId: string, currentBpId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.clinicId !== clinicId) {
      throw new ForbiddenException('User does not belong to this clinic');
    }
    if (user.businessPartnerId && user.businessPartnerId !== currentBpId) {
      throw new ConflictException('User is already linked to another Business Partner');
    }
  }
}

