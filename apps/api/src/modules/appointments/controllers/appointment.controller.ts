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
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import {
  AppointmentService,
  CreateAppointmentDto,
  UpdateStatusDto,
} from '../services/appointment.service';

@Controller('appointments')
@Roles(Role.VET, Role.ASSISTANT, Role.CLINIC_OWNER)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @Audit({ entity: 'Appointment', operation: 'create' })
  create(@TenantId() clinicId: string, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create(clinicId, dto);
  }

  @Get()
  findAll(
    @TenantId() clinicId: string,
    @Query('date') date?: string,
    @Query('vetUserId') vetUserId?: string,
  ) {
    return this.appointmentService.findAll(clinicId, { date, vetUserId });
  }

  @Get(':id')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.appointmentService.findById(clinicId, id);
  }

  @Patch(':id/status')
  @Audit({ entity: 'Appointment', operation: 'update' })
  updateStatus(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appointmentService.updateStatus(clinicId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ASSISTANT, Role.CLINIC_OWNER)
  @Audit({ entity: 'Appointment', operation: 'delete' })
  cancel(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() { reason }: { reason: string },
  ) {
    return this.appointmentService.cancel(clinicId, id, reason ?? 'Cancelled');
  }
}
