import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsPositive,
  Min,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseInvoiceLineDto {
  @IsUUID()
  @IsOptional()
  poLineId?: string;

  @IsUUID()
  @IsOptional()
  grLineId?: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPriceMinor!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxRateBps?: number;
}

export class CreatePurchaseInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsDateString()
  @IsNotEmpty()
  invoiceDate!: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseInvoiceLineDto)
  lines!: PurchaseInvoiceLineDto[];
}
