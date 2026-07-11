import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { SequenceConfigService, UpsertSequenceConfigDto, UpdateSequenceConfigDto } from '../services/sequence-config.service';

@Controller('document-sequence/configs')
@Roles(Role.SUPER_ADMIN, Role.CLINIC_OWNER)
export class SequenceConfigController {
  constructor(private readonly sequenceConfigService: SequenceConfigService) {}

  @Get()
  findAll(@TenantId() clinicId: string) {
    return this.sequenceConfigService.findAll(clinicId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  upsert(
    @TenantId() clinicId: string,
    @Body() dto: UpsertSequenceConfigDto,
  ) {
    return this.sequenceConfigService.upsert(clinicId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSequenceConfigDto,
  ) {
    return this.sequenceConfigService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.sequenceConfigService.remove(clinicId, id);
  }
}
