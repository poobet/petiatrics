import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

  @Patch(':id')
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'users', operation: 'update' })
  update(
    @Param('id') id: string,
    @TenantId() clinicId: string,
    @Body() dto: any,
  ) {
    return this.users.updateClient(id, clinicId, dto);
  }

  @Post(':id/link-bp')
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'users', operation: 'update' })
  linkBp(
    @Param('id') id: string,
    @TenantId() clinicId: string,
    @Body() dto: { businessPartnerId: string },
  ) {
    return this.users.linkToBusinessPartner(id, dto.businessPartnerId, clinicId);
  }

  @Post(':id/unlink-bp')
  @Permissions('PATIENT:EDIT')
  @Audit({ entity: 'users', operation: 'update' })
  unlinkBp(
    @Param('id') id: string,
    @TenantId() clinicId: string,
  ) {
    return this.users.unlinkFromBusinessPartner(id, clinicId);
  }
}
