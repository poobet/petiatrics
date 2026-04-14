import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BusinessPartnerType } from '@petiatrics/types';

export class ListBusinessPartnersDto {
  @IsOptional()
  @IsEnum(BusinessPartnerType)
  type?: BusinessPartnerType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
