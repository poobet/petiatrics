import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SubmitAdjustmentDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

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
  @IsString()
  notes?: string;
}
