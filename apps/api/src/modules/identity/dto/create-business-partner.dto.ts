import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerType, BpRole } from '@petiatrics/types';

export class BpVetDto {
  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  @IsOptional()
  @IsString()
  specialty?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultDfRate?: number | null;
}

// Extension-only — vendor classification metadata.
// taxId and creditTermDays are now on BusinessPartner core.
export class BpSupplierDto {
  @IsOptional()
  @IsString()
  vendorGroupId?: string | null;
}

export class BpContactDto {
  /** Present for existing rows; absent for new rows. Server always generates a fresh UUID for new rows. */
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((o: BpContactDto) => o.phone != null)
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((o: BpContactDto) => o.email != null)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ValidateIf((o: BpContactDto) => o.lineId != null)
  @IsOptional()
  @IsString()
  lineId?: string | null;

  @IsOptional()
  @IsString()
  position?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateBusinessPartnerDto {
  @IsEnum(BusinessPartnerType)
  type!: BusinessPartnerType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  // ── Thai compliance core fields ──────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Matches(/^\d{13}$/, { message: 'taxId must be a 13-digit Thai TIN' })
  taxId?: string | null;

  @IsOptional()
  @IsBoolean()
  isHeadOffice?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'branchCode must be 5 digits' })
  branchCode?: string | null;

  @IsOptional()
  @IsString()
  addressLine1?: string | null;

  @IsOptional()
  @IsString()
  subDistrict?: string | null;

  @IsOptional()
  @IsString()
  district?: string | null;

  @IsOptional()
  @IsString()
  province?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'zipcode must be 5 digits' })
  zipcode?: string | null;

  // ── BP hierarchy (same clinic) ───────────────────────────────────────────
  @IsOptional()
  @IsUUID()
  parentBpId?: string | null;

  // ── Tax defaults (global TaxCode references) ─────────────────────────────
  // Note: item-level VAT on invoices is driven by ItemMaster, not these defaults.
  @IsOptional()
  @IsUUID()
  defaultVatCodeId?: string | null;

  @IsOptional()
  @IsUUID()
  defaultWhtCodeId?: string | null;

  // ── Payment defaults ─────────────────────────────────────────────────────
  @IsOptional()
  @IsInt()
  @Min(0)
  creditTermDays?: number;

  // ── Communication ────────────────────────────────────────────────────────
  @ValidateIf((o: CreateBusinessPartnerDto) => o.phone != null)
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.email != null)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.lineId != null)
  @IsOptional()
  @IsString()
  lineId?: string | null;

  // ── Commercial ───────────────────────────────────────────────────────────
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  creditHold?: boolean;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.discountGroupId != null)
  @IsOptional()
  @IsString()
  discountGroupId?: string | null;

  // ── BpGroup & auto-code ───────────────────────────────────────────
  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  // ── CRM fields ────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  isMarketingOptIn?: boolean;

  @IsOptional()
  @IsString()
  internalNotes?: string | null;

  @IsOptional()
  @IsString()
  alertMessage?: string | null;

  // ── Bank account ─────────────────────────────────────────────────────────
  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountName != null)
  @IsOptional()
  @IsString()
  bankAccountName?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountBranch != null)
  @IsOptional()
  @IsString()
  bankAccountBranch?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.bankAccountNumber != null)
  @IsOptional()
  @IsString()
  bankAccountNumber?: string | null;

  // ── Contact persons ──────────────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BpContactDto)
  contacts?: BpContactDto[];

  // ── Infor LN role activation ─────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsEnum(BpRole, { each: true })
  activeRoles?: BpRole[];

  @IsOptional()
  @IsUUID()
  linkUserId?: string | null;

  // ── Extensions ───────────────────────────────────────────────────────────
  @ValidateIf((o: CreateBusinessPartnerDto) => o.type === BusinessPartnerType.VET)
  @IsObject()
  @ValidateNested()
  @Type(() => BpVetDto)
  vet?: BpVetDto | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BpSupplierDto)
  supplier?: BpSupplierDto | null;
}
