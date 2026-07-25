import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CommissionType } from '@prisma/client';

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
