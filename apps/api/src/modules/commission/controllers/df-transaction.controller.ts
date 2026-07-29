import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { DfTransactionService } from '../services/df-transaction.service';
import { DfQueryDto } from '../dto/df-query.dto';
import { CreateDfAdjustmentDto } from '../dto/create-df-adjustment.dto';

@Controller('commission/transactions')
export class DfTransactionController {
  constructor(private readonly txService: DfTransactionService) {}

  @Get()
  @Permissions('COMMISSION:VIEW')
  findLedger(
    @TenantId() clinicId: string,
    @Query() queryDto: DfQueryDto,
  ) {
    return this.txService.findLedger(clinicId, queryDto);
  }

  @Get('summary')
  @Permissions('COMMISSION:VIEW')
  getSummary(
    @TenantId() clinicId: string,
    @Query() queryDto: DfQueryDto,
  ) {
    return this.txService.getSummary(clinicId, queryDto);
  }

  @Post('adjustment')
  @Permissions('COMMISSION:ADD')
  @Audit({ entity: 'DfTransaction', operation: 'create_adjustment' })
  createAdjustment(
    @TenantId() clinicId: string,
    @Body() dto: CreateDfAdjustmentDto,
  ) {
    return this.txService.createAdjustment(clinicId, dto);
  }
}
