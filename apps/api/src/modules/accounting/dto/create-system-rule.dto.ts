import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

export class CreateSystemRuleDto {
  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsObject()
  conditions!: Record<string, unknown>;

  @IsObject()
  action!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
