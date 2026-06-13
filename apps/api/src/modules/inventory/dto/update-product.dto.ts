import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemUnitConversionDto, ProductAccessoryDto, UpsertBranchSettingDto } from './create-product.dto';
import { DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemUnitConversionDto)
  conversions?: ItemUnitConversionDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  standardCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSellingPrice?: number;

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @IsOptional()
  @IsUUID()
  defaultTaxCodeId?: string | null;

  @IsOptional()
  @IsString()
  genericName?: string | null;

  @IsOptional()
  @IsBoolean()
  isControlledSubstance?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBatchAndExpiryTracking?: boolean;

  @IsOptional()
  @IsUUID()
  defaultSupplierId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDoctorFee?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAccessoryDto)
  accessories?: ProductAccessoryDto[];

  // ── Compliance & Tax fields (POS Dynamic Tax Engine) ──────────────────────
  @IsOptional()
  @IsEnum(DefaultVatType)
  defaultVatType?: DefaultVatType;

  @IsOptional()
  @IsEnum(WhtRate)
  whtRate?: WhtRate;

  @IsOptional()
  @IsEnum(DispensingCategory)
  dispensingCategory?: DispensingCategory;

  // ── GL Account mappings ────────────────────────────────────────────────────
  @IsOptional()
  @IsUUID()
  revenueAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  cogsAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  inventoryAssetAccountId?: string | null;

  // ── Per-branch settings (upserted alongside update) ───────────────────────
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertBranchSettingDto)
  branchSettings?: UpsertBranchSettingDto[];
}
