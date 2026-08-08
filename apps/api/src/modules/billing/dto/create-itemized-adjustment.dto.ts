import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemAdjustmentInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Original item ID is required' })
  originalItemId!: string;

  @IsNumber()
  @Min(0.001, { message: 'Adjust quantity must be greater than 0' })
  adjustQty!: number;

  @IsInt({ message: 'Adjust amount must be a whole number in minor units (satang)' })
  @Min(1, { message: 'Adjust amount must be at least 1' })
  adjustAmountMinor!: number;

  @IsOptional()
  @IsBoolean()
  returnToStock?: boolean;
}

export class CreateItemizedAdjustmentDto {
  @IsEnum(['CREDIT_NOTE', 'DEBIT_NOTE'], {
    message: 'Type must be CREDIT_NOTE or DEBIT_NOTE',
  })
  type!: 'CREDIT_NOTE' | 'DEBIT_NOTE';

  @IsString()
  @IsNotEmpty({ message: 'Reason code is required' })
  reasonCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason description is required' })
  reason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemAdjustmentInputDto)
  items!: ItemAdjustmentInputDto[];
}
