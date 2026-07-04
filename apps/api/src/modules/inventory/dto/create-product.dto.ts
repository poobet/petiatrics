import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemType, DefaultVatType, WhtRate, DispensingCategory } from '@petiatrics/types';

export class ItemUnitConversionDto {
  @IsUUID()
  unitId!: string;

  @IsNumber()
  @Min(0.000001)
  ratioToBase!: number;
}

export class ProductAccessoryDto {
  @IsUUID()
  childProductId!: string;

  @IsNumber()
  @Min(0.001)
  quantityRatio!: number;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ItemType)
  itemType!: ItemType;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  baseUnitId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemUnitConversionDto)
  conversions?: ItemUnitConversionDto[];

  @IsNumber()
  @Min(0)
  standardCost!: number;

  @IsNumber()
  @Min(0)
  baseSellingPrice!: number;

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
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string | null;

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

  // ── Per-branch settings (upserted alongside create) ───────────────────────
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertBranchSettingDto)
  branchSettings?: UpsertBranchSettingDto[];
}

export class UpsertBranchSettingDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsNumber()
  @Min(0)
  retailPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  movingAverageCost?: number;
}
