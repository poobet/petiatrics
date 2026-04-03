import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { CurrentUser, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { UserContext } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { StockService } from '../services/stock.service';

@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('replenish')
  @Roles(Role.CLINIC_OWNER)
  @Audit({ entity: 'StockMovement', operation: 'create' })
  replenish(
    @TenantId() clinicId: string,
    @CurrentUser() user: UserContext,
    @Body() body: { productId: string; quantity: number; referenceId: string },
  ) {
    return this.stockService.replenish(clinicId, {
      ...body,
      actorId: user.userId,
    });
  }

  @Get('movements')
  @Roles(Role.CLINIC_OWNER, Role.VET)
  getMovements(
    @TenantId() clinicId: string,
    @Query('productId') productId?: string,
  ) {
    return this.stockService.getMovements(clinicId, productId);
  }
}
