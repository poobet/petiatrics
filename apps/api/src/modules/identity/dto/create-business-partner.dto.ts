import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerType } from '@petiatrics/types';

export class BpVetDto {
  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  whtRate?: number;
}

export class BpSupplierDto {
  @IsString()
  @IsNotEmpty()
  taxId!: string;

  @IsNumber()
  @Min(0)
  creditTermDays!: number;
}

export class CreateBusinessPartnerDto {
  @IsEnum(BusinessPartnerType)
  type!: BusinessPartnerType;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  linkUserId?: string | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.type === BusinessPartnerType.VET)
  @IsObject()
  @ValidateNested()
  @Type(() => BpVetDto)
  vet?: BpVetDto | null;

  @ValidateIf((o: CreateBusinessPartnerDto) => o.type === BusinessPartnerType.SUPPLIER)
  @IsObject()
  @ValidateNested()
  @Type(() => BpSupplierDto)
  supplier?: BpSupplierDto | null;
}
