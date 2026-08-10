import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ReasonCodeType } from '@prisma/client';

export class CreateReasonCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(ReasonCodeType)
  @IsOptional()
  type?: ReasonCodeType;

  @IsBoolean()
  @IsOptional()
  requiresVatCalculation?: boolean;

  @IsString()
  @IsOptional()
  defaultLocationId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class UpdateReasonCodeDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ReasonCodeType)
  @IsOptional()
  type?: ReasonCodeType;

  @IsBoolean()
  @IsOptional()
  requiresVatCalculation?: boolean;

  @IsString()
  @IsOptional()
  defaultLocationId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
