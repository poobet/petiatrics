import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, IsPositive, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class GoodsReceiptLineDto {
  @IsUUID()
  @IsOptional()
  poLineId?: string;

  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @IsPositive()
  quantityReceived!: number;

  @IsString()
  @IsOptional()
  lotNumber?: string;

  @IsOptional()
  expiryDate?: Date;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsOptional()
  overrideReason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}
