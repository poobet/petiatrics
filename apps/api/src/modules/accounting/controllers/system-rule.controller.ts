import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { SystemRuleService } from '../services/system-rule.service';
import { CreateSystemRuleDto } from '../dto/create-system-rule.dto';
import { UpdateSystemRuleDto } from '../dto/update-system-rule.dto';

@Controller('accounting/system-rules')
export class SystemRuleController {
  constructor(private readonly ruleService: SystemRuleService) {}

  @Post()
  create(@Body() dto: CreateSystemRuleDto) {
    return this.ruleService.create(dto);
  }

  @Get()
  findAll(
    @Query('eventType') eventType?: string,
    @Query('clinicId') clinicId?: string,
  ) {
    return this.ruleService.findAll({ eventType, clinicId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ruleService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSystemRuleDto) {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ruleService.remove(id);
  }
}
