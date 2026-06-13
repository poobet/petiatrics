import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Audit } from '../../../common/interceptors/audit.interceptor';

@Controller('clinic/clients')
export class ClientsController {
  constructor(private readonly users: UserService) {}

  @Get()
  @Permissions('PATIENT:VIEW')
  list(@TenantId() clinicId: string) {
    return this.users.findClientsByClinic(clinicId);
  }

  @Get(':id')
  @Permissions('PATIENT:VIEW')
  getById(@Param('id') id: string, @TenantId() clinicId: string) {
    return this.users.findClientById(clinicId, id);
  }

  @Post()
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'users', operation: 'create' })
  create(@TenantId() clinicId: string, @Body() dto: CreateClientDto) {
    return this.users.createClient(clinicId, dto);
  }
}
