import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { BusinessPartnerType } from '@petiatrics/types';

export class ListBusinessPartnersDto {
  /** Filter by a single type (legacy, kept for backward compatibility) */
  @IsOptional()
  @IsEnum(BusinessPartnerType)
  type?: BusinessPartnerType;

  /**
   * Filter by multiple types at once.
   * Query string: ?types=STAFF&types=VET
   * When provided, takes precedence over `type`.
   */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  })
  @IsEnum(BusinessPartnerType, { each: true })
  types?: BusinessPartnerType[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
