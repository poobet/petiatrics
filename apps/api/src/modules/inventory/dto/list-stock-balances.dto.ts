import { IsOptional, IsUUID, IsBoolean, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListStockBalancesDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' || value === true)
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsNumber()
  @Min(1)
  limit?: number = 50;
}
