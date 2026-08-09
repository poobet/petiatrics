import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { ItemCategoryService, CreateItemCategoryDto, UpdateItemCategoryDto } from '../services/item-category.service';

@Controller('inventory/item-categories')
export class ItemCategoryController {
  constructor(private readonly itemCategoryService: ItemCategoryService) {}

  @Get()
  async findAll(
    @TenantId() clinicId: string,
    @Query('search') search?: string,
  ) {
    return this.itemCategoryService.findAll(clinicId, search);
  }

  @Post()
  async create(
    @TenantId() clinicId: string,
    @Body() dto: CreateItemCategoryDto,
  ) {
    return this.itemCategoryService.create(clinicId, dto);
  }

  @Patch(':id')
  async update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateItemCategoryDto,
  ) {
    return this.itemCategoryService.update(clinicId, id, dto);
  }

  @Delete(':id')
  async deactivate(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.itemCategoryService.deactivate(clinicId, id);
  }
}
