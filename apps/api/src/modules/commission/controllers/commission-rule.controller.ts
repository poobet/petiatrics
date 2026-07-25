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
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { CommissionRuleService } from '../services/commission-rule.service';
import { CreateCommissionRuleDto } from '../dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from '../dto/update-commission-rule.dto';

@Controller('commission/rules')
export class CommissionRuleController {
  constructor(private readonly ruleService: CommissionRuleService) {}

  @Post()
  @Permissions('COMMISSION:MANAGE_RULES')
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreateCommissionRuleDto,
  ) {
    return this.ruleService.create(clinicId, dto);
  }

  @Get()
  @Permissions('COMMISSION:VIEW')
  findAll(
    @TenantId() clinicId: string,
    @Query('bpId') bpId?: string,
  ) {
    return this.ruleService.findAll(clinicId, bpId);
  }

  @Get(':id')
  @Permissions('COMMISSION:VIEW')
  findOne(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.ruleService.findOne(clinicId, id);
  }

  @Patch(':id')
  @Permissions('COMMISSION:MANAGE_RULES')
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
  ) {
    return this.ruleService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @Permissions('COMMISSION:MANAGE_RULES')
  remove(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.ruleService.remove(clinicId, id);
  }
}
