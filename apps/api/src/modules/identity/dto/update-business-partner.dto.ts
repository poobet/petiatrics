import {
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
import { BpVetDto, BpSupplierDto } from './create-business-partner.dto';

export class UpdateBusinessPartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  linkUserId?: string | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BpVetDto)
  vet?: BpVetDto | null;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BpSupplierDto)
  supplier?: BpSupplierDto | null;
}
