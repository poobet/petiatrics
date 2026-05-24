import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Role } from '@petiatrics/types';
import { ReferenceService } from '../services/reference.service';

@Controller('inventory/reference')
@Roles(Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF)
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get('categories')
  getCategories() {
    return this.referenceService.getItemCategories();
  }

  @Get('units')
  getUnits() {
    return this.referenceService.getUnitsOfMeasure();
  }

  @Get('tax-codes')
  getTaxCodes() {
    return this.referenceService.getTaxCodes();
  }

  @Get('gl-accounts')
  getGLAccounts() {
    return this.referenceService.getGLAccounts();
  }
}
