import { IsString, IsOptional } from 'class-validator';

export class PayPaymentRunDto {
  @IsString()
  paymentMethod!: string; // e.g. BANK_TRANSFER, CASH, CHEQUE

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
