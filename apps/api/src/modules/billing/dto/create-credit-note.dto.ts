import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceLineItemDto } from '../services/invoice.service';

export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason code is required for Credit Note' })
  reasonCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Reason description is required for Credit Note' })
  reason!: string;

  /** Optional partial line items. If omitted, full credit note for all lines of original invoice. */
  @IsOptional()
  @IsArray()
  lineItems?: CreateInvoiceLineItemDto[];
}
