import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceLineItemDto } from '../services/invoice.service';

export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason code is required for Credit Note' })
  reasonCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason description is required for Credit Note' })
  reason!: string;

  /**
   * Optional partial refund amount in minor currency units (satang).
   * If provided, a single-line CN is created for this amount instead of copying all original line items.
   * Must not exceed the remaining refundable balance of the original invoice.
   */
  @IsOptional()
  @IsInt({ message: 'Refund amount must be a whole number in minor currency units' })
  @Min(1, { message: 'Refund amount must be at least 1' })
  refundAmountMinor?: number;

  /** Optional partial line items. If omitted and refundAmountMinor is not set, full credit note for all lines of original invoice. */
  @IsOptional()
  @IsArray()
  lineItems?: CreateInvoiceLineItemDto[];
}
