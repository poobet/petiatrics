import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ActiveBranch, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';

const READ_ROLES = [Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF];
const WRITE_ROLES = [Role.CLINIC_OWNER];

@Controller('inventory/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @Audit({ entity: 'Product', operation: 'create' })
  create(@TenantId() clinicId: string, @Body() dto: CreateProductDto) {
    return this.productService.create(clinicId, dto);
  }

  @Get()
  @Roles(...READ_ROLES)
  @UseGuards(BranchContextGuard)
  findAll(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
    @Query() query: ListProductsDto,
  ) {
    return this.productService.findAll(clinicId, branchId, query);
  }

  @Get('low-stock')
  @Roles(...READ_ROLES)
  @UseGuards(BranchContextGuard)
  getLowStock(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
  ) {
    return this.productService.getLowStock(clinicId, branchId);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.productService.findById(clinicId, id);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @Audit({ entity: 'Product', operation: 'update' })
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(clinicId, id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(...WRITE_ROLES)
  @Audit({ entity: 'Product', operation: 'status_change' })
  deactivate(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.productService.deactivate(clinicId, id);
  }
}
