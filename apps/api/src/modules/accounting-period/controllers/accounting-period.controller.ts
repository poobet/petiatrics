import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role, UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { AccountingPeriodService } from '../services/accounting-period.service';
import { CreateAccountingPeriodDto } from '../dto/create-period.dto';
import { ReopenAccountingPeriodDto } from '../dto/reopen-period.dto';

@Controller('accounting-periods')
export class AccountingPeriodController {
  constructor(private readonly periodService: AccountingPeriodService) {}

  @Get()
  @Roles(Role.CLINIC_OWNER)
  @Permissions('ACCOUNTING_PERIOD:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('year') year?: number,
  ) {
    return this.periodService.findAll(clinicId, year);
  }

  @Post()
  @Roles(Role.CLINIC_OWNER)
  @Permissions('ACCOUNTING_PERIOD:CLOSE')
  @Audit({ entity: 'AccountingPeriod', operation: 'create' })
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreateAccountingPeriodDto,
  ) {
    return this.periodService.create(clinicId, dto);
  }

  @Patch(':id/close')
  @Roles(Role.CLINIC_OWNER)
  @Permissions('ACCOUNTING_PERIOD:CLOSE')
  @Audit({ entity: 'AccountingPeriod', operation: 'close' })
  closePeriod(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Param('id') id: string,
  ) {
    return this.periodService.closePeriod(clinicId, id, user.userId);
  }

  @Patch(':id/reopen')
  @Roles(Role.CLINIC_OWNER)
  @Permissions('ACCOUNTING_PERIOD:REOPEN')
  @Audit({ entity: 'AccountingPeriod', operation: 'reopen' })
  reopenPeriod(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: ReopenAccountingPeriodDto,
  ) {
    return this.periodService.reopenPeriod(clinicId, id, dto);
  }
}
