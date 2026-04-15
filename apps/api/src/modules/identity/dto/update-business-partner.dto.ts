import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BpRole } from '@petiatrics/types';
import { BpVetDto, BpSupplierDto } from './create-business-partner.dto';

export class UpdateBusinessPartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

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

  // ── BP hierarchy ─────────────────────────────────────────────────────────
  @IsOptional()
  @IsUUID()
  parentBpId?: string | null;

  // ── Tax defaults ─────────────────────────────────────────────────────────
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
  @IsOptional()
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

