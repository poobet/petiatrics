import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum DfAdjustmentTypeDto {
  ADJUSTMENT_ADD = 'ADJUSTMENT_ADD',
  ADJUSTMENT_DEDUCT = 'ADJUSTMENT_DEDUCT',
}

export class CreateDfAdjustmentDto {
  @IsUUID()
  @IsNotEmpty()
  businessPartnerId!: string;

  @IsEnum(DfAdjustmentTypeDto)
  type!: DfAdjustmentTypeDto;

  /** Amount in minor units (satang). Always positive number; type determines if added or deducted. */
  @IsInt()
  amountMinor!: number;

  @IsString()
  @IsNotEmpty({ message: 'Adjustment reason is required' })
  reason!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  referenceTransactionId?: string;
}
