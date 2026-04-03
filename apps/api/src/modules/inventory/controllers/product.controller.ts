import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import {
  ProductService,
  CreateProductDto,
  UpdateProductDto,
} from '../services/product.service';

@Controller('inventory/products')
@Roles(Role.CLINIC_OWNER)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Audit({ entity: 'Product', operation: 'create' })
  create(@TenantId() clinicId: string, @Body() dto: CreateProductDto) {
    return this.productService.create(clinicId, dto);
  }

  @Get()
  @Roles(Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT)
  findAll(@TenantId() clinicId: string) {
    return this.productService.findAll(clinicId);
  }

  @Get('low-stock')
  @Roles(Role.CLINIC_OWNER, Role.VET)
  getLowStock(@TenantId() clinicId: string) {
    return this.productService.getLowStock(clinicId);
  }

  @Get(':id')
  @Roles(Role.CLINIC_OWNER, Role.VET)
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.productService.findById(clinicId, id);
  }

  @Patch(':id')
  @Audit({ entity: 'Product', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(clinicId, id, dto);
  }
}
