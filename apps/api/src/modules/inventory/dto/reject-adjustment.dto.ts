import { IsString, IsNotEmpty } from 'class-validator';

export class RejectAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
