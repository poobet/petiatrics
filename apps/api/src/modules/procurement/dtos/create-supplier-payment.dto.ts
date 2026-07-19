import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
  IsNumber,
  Min,
  IsUUID,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentAllocationDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseInvoiceId!: string;

  @IsNumber()
  @Min(1)
  amountAllocatedMinor!: number;
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  CHEQUE = 'CHEQUE',
  PROMISSORY_NOTE = 'PROMISSORY_NOTE',
}

export class CreateSupplierPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsNumber()
  @Min(1)
  amountMinor!: number;

  // e-WHT fields (Thai tax compliance)
  @IsNumber()
  @Min(0)
  @IsOptional()
  whtAmountMinor?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  whtRateBps?: number; // e.g. 100 = 1%, 300 = 3%

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations!: PaymentAllocationDto[];
}
