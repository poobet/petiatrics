import { IsInt, Max, Min, IsOptional, IsString } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsString()
  @IsOptional()
  branchId?: string;
}
