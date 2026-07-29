import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role, UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { InvoiceService, CreateInvoiceDto } from '../services/invoice.service';
import { PinVerificationService } from '../../identity/services/pin-verification.service';

export class VerifyOverridePinDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  @Matches(/^\d+$/, { message: 'PIN must contain digits only' })
  pin!: string;
}

import { CreateCreditNoteDto } from '../dto/create-credit-note.dto';

@Controller('billing/invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pinVerification: PinVerificationService,
  ) {}

  @Post('verify-override-pin')
  @Roles(Role.CASHIER, Role.CLINIC_OWNER)
  @Permissions('BILLING:ADD')
  verifyOverridePin(
    @TenantId() clinicId: string,
    @Body() dto: VerifyOverridePinDto,
  ) {
    return this.pinVerification.verifyOverridePin(clinicId, dto.pin);
  }

  @Post()
  @Roles(Role.CASHIER, Role.CLINIC_OWNER)
  @Permissions('BILLING:ADD')
  @Audit({ entity: 'Invoice', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoiceService.create(clinicId, dto);
  }

  @Get()
  @Roles(Role.CASHIER, Role.CLINIC_OWNER, Role.ASSISTANT)
  @Permissions('BILLING:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('status') status?: string,
  ) {
    return this.invoiceService.findAll(clinicId, status);
  }

  @Get(':id')
  @Roles(Role.CASHIER, Role.CLINIC_OWNER, Role.ASSISTANT)
  @Permissions('BILLING:VIEW')
  findOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.invoiceService.findById(clinicId, id);
  }

  @Patch(':id/issue')
  @Roles(Role.CASHIER, Role.CLINIC_OWNER)
  @Permissions('BILLING:EDIT')
  @Audit({ entity: 'Invoice', operation: 'status_change' })
  issue(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.invoiceService.issue(clinicId, id);
  }

  @Patch(':id/pay')
  @Roles(Role.CASHIER, Role.CLINIC_OWNER)
  @Permissions('BILLING:EDIT')
  @Audit({ entity: 'Invoice', operation: 'status_change' })
  markPaid(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.invoiceService.markPaid(clinicId, id);
  }

  @Post(':id/credit-note')
  @Roles(Role.CASHIER, Role.CLINIC_OWNER)
  @Permissions('BILLING:EDIT')
  @Audit({ entity: 'Invoice', operation: 'create_credit_note' })
  createCreditNote(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
  ) {
    return this.invoiceService.createCreditNote(clinicId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINIC_OWNER)
  @Permissions('BILLING:VOID')
  @Audit({ entity: 'Invoice', operation: 'void' })
  voidInvoice(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.invoiceService.voidInvoice(clinicId, id, user.userId, body.reason);
  }
}
