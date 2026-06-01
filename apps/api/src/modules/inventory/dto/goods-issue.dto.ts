import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
} from 'class-validator';

export class GoodsIssueDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsUUID()
  productId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  /**
   * Required when the chosen lot is not the FEFO-recommended lot or the lot is expired.
   * Server will reject the transaction with 400 if this field is absent in those cases.
   */
  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}
