import { IsString, IsDateString } from 'class-validator';

export class CreatePaymentRunDto {
  @IsString()
  businessPartnerId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
