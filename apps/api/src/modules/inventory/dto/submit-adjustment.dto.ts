import { IsUUID, IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';

export enum AdjustmentReasonCode {
  COUNT_DISCREPANCY = 'COUNT_DISCREPANCY',
  DAMAGED = 'DAMAGED',
  EXPIRED = 'EXPIRED',
}

export class SubmitAdjustmentDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  /** The physical count observed during the reconciliation. Must be >= 0. */
  @IsNumber()
  @Min(0)
  physicalCount!: number;

  @IsOptional()
  @IsEnum(AdjustmentReasonCode)
  reasonCode?: AdjustmentReasonCode;

  @IsOptional()
  @IsString()
  notes?: string;
}
