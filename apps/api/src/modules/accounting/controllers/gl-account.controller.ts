import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { GLAccountType } from '@prisma/client';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { GlAccountService } from '../services/gl-account.service';
import { CreateGlAccountDto } from '../dto/create-gl-account.dto';

@Controller('accounting/gl-accounts')
export class GlAccountController {
  constructor(private readonly glAccountService: GlAccountService) {}

  @Get()
  async findAll(
    @TenantId() clinicId: string,
    @Query('type') type?: GLAccountType,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.glAccountService.getAccounts(clinicId, {
      type,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Post()
  async create(
    @TenantId() clinicId: string,
    @Body() dto: CreateGlAccountDto,
  ) {
    return this.glAccountService.createAccount(clinicId, dto);
  }

  @Delete(':id')
  async deactivate(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.glAccountService.deactivateAccount(clinicId, id);
  }
}
