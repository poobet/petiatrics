import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemUnitConversionDto } from './create-product.dto';

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
  minimumStock?: number;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
