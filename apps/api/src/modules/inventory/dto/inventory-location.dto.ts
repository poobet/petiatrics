import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateInventoryLocationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isSellable?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateInventoryLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isSellable?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
