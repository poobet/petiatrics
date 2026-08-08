import { IsString, IsEnum, MinLength, Matches } from 'class-validator';
import { GLAccountType } from '@prisma/client';

export class CreateGlAccountDto {
  @IsString()
  @Matches(/^[0-9]{4,6}$/, { message: 'Code must be a 4-6 digit number' })
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(GLAccountType)
  type!: GLAccountType;
}
