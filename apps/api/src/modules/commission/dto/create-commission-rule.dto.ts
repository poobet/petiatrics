import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { CommissionType } from '@prisma/client';

export class CreateCommissionRuleDto {
  @IsString()
  businessPartnerId!: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  @IsNumber()
  @Min(0)
  rate!: number;
}
