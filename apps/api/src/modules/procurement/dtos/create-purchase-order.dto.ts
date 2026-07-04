import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested, IsNumber, IsPositive, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderLineDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsOptional()
  uomId?: string;

  @IsNumber()
  @IsPositive()
  quantityOrdered!: number;

  @IsNumber()
  @Min(0)
  unitPriceMinor!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRateBps?: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditTermDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines!: PurchaseOrderLineDto[];
}
