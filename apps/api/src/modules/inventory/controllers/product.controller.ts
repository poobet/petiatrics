import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { BranchContextGuard } from '../../../common/guards/branch-context.guard';
import { ActiveBranch, TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Audit } from '../../../common/interceptors/audit.interceptor';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { UpsertBranchSettingDto } from '../dto/create-product.dto';

const READ_ROLES = [Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF];
const WRITE_ROLES = [Role.CLINIC_OWNER];

@Controller('inventory/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(...WRITE_ROLES)
  @Permissions('INVENTORY:ADD')
  @HttpCode(HttpStatus.CREATED)
  @Audit({ entity: 'Product', operation: 'create' })
  create(@TenantId() clinicId: string, @Body() dto: CreateProductDto) {
    return this.productService.create(clinicId, dto);
  }

  @Get()
  @Roles(...READ_ROLES)
  @Permissions('INVENTORY:VIEW')
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
  @Permissions('INVENTORY:VIEW')
  @UseGuards(BranchContextGuard)
  getLowStock(
    @TenantId() clinicId: string,
    @ActiveBranch() branchId: string,
  ) {
    return this.productService.getLowStock(clinicId, branchId);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @Permissions('INVENTORY:VIEW')
  findOne(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.productService.findById(clinicId, id);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @Permissions('INVENTORY:EDIT')
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
  @Permissions('INVENTORY:DELETE')
  @Audit({ entity: 'Product', operation: 'status_change' })
  deactivate(@TenantId() clinicId: string, @Param('id') id: string) {
    return this.productService.deactivate(clinicId, id);
  }

  @Get('barcode/:barcode')
  @Roles(...READ_ROLES)
  @Permissions('INVENTORY:VIEW')
  findByBarcode(@TenantId() clinicId: string, @Param('barcode') barcode: string) {
    return this.productService.findByBarcode(clinicId, barcode);
  }

  @Get(':id/branch-settings')
  @Roles(...READ_ROLES)
  @Permissions('INVENTORY:VIEW')
  getBranchSettings(@Param('id') id: string) {
    return this.productService.getBranchSettings(id);
  }

  @Put(':id/branch-settings')
  @Roles(...WRITE_ROLES)
  @Permissions('INVENTORY:EDIT')
  @Audit({ entity: 'ProductBranchSetting', operation: 'update' })
  upsertBranchSettings(
    @Param('id') id: string,
    @Body() body: { settings: UpsertBranchSettingDto[] },
  ) {
    return this.productService.upsertBranchSettings(id, body.settings);
  }
}
