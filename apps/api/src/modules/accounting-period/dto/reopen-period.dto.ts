import { IsNotEmpty, IsString } from 'class-validator';

export class ReopenAccountingPeriodDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason for reopening accounting period is required' })
  reason!: string;
}
