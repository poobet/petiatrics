import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  whtRate?: number;
}

// Extension-only — vendor classification metadata.
// taxId and creditTermDays are now on BusinessPartner core.
export class BpSupplierDto {
  @IsOptional()
  @IsString()
  vendorGroupId?: string | null;
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
  @IsNumber()
  @Min(0)
  creditTermDays?: number;

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
