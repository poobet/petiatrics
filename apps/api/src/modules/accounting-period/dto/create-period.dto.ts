import { IsInt, IsMax, IsMin, IsOptional, IsString } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsInt()
  @IsMin(2000)
  @IsMax(2100)
  year!: number;

  @IsInt()
  @IsMin(1)
  @IsMax(12)
  month!: number;

  @IsString()
  @IsOptional()
  branchId?: string;
}
