import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '@petiatrics/types';

export class CreateStaffDto {
  /** Username prefix — will be combined as prefix@clinicSlug */
  @IsString()
  @Matches(/^[a-z0-9_-]{2,30}$/, {
    message: 'Username prefix must be 2-30 lowercase alphanumeric characters, hyphens, or underscores',
  })
  usernamePrefix!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsString()
  @IsNotEmpty()
  role!: Role;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}
