import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { CreateInvoiceLineItemDto } from '../services/invoice.service';

export class CreateDebitNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason code is required for Debit Note' })
  reasonCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason description is required for Debit Note' })
  reason!: string;

  /**
   * Additional charge amount in minor currency units (satang).
   * Creates a DN with positive amounts representing the additional charge.
   */
  @IsInt({ message: 'Additional amount must be a whole number in minor currency units' })
  @Min(1, { message: 'Additional amount must be at least 1' })
  additionalAmountMinor!: number;

  /** Optional line items for detailed breakdown. If omitted, a single-line DN is created. */
  @IsOptional()
  @IsArray()
  lineItems?: CreateInvoiceLineItemDto[];
}
