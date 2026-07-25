import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { DfTransactionStatus } from '@prisma/client';

export class DfQueryDto {
  @IsOptional()
  @IsString()
  businessPartnerId?: string;

  @IsOptional()
  @IsEnum(DfTransactionStatus)
  status?: DfTransactionStatus;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;
}
