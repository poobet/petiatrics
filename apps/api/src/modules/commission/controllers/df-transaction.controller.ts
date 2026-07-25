import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { DfTransactionService } from '../services/df-transaction.service';
import { DfQueryDto } from '../dto/df-query.dto';

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
}
