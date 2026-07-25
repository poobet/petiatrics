import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DfPaymentRunStatus } from '@prisma/client';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { UserContext } from '@petiatrics/types';
import { DfPaymentRunService } from '../services/df-payment-run.service';
import { CreatePaymentRunDto } from '../dto/create-payment-run.dto';
import { PayPaymentRunDto } from '../dto/pay-payment-run.dto';

@Controller('commission/payment-runs')
export class DfPaymentRunController {
  constructor(private readonly paymentRunService: DfPaymentRunService) {}

  @Post()
  @Permissions('COMMISSION:CREATE_PAYMENT_RUN')
  createDraft(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: CreatePaymentRunDto,
  ) {
    return this.paymentRunService.createDraftRun(clinicId, user.userId, dto);
  }

  @Get()
  @Permissions('COMMISSION:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('bpId') bpId?: string,
    @Query('status') status?: DfPaymentRunStatus,
  ) {
    return this.paymentRunService.findAll(clinicId, bpId, status);
  }

  @Get(':id')
  @Permissions('COMMISSION:VIEW')
  findOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.paymentRunService.findOne(clinicId, id);
  }

  @Patch(':id/approve')
  @Permissions('COMMISSION:APPROVE_PAYMENT_RUN')
  approve(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.paymentRunService.approveRun(clinicId, user.userId, id);
  }

  @Patch(':id/pay')
  @Permissions('COMMISSION:MARK_PAID')
  pay(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() dto: PayPaymentRunDto,
  ) {
    return this.paymentRunService.payRun(clinicId, user.userId, id, dto);
  }

  @Patch(':id/cancel')
  @Permissions('COMMISSION:CREATE_PAYMENT_RUN')
  cancel(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.paymentRunService.cancelRun(clinicId, id);
  }
}
