import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../../common/guards/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { DocumentTypeService, CreateDocumentTypeDto, UpdateDocumentTypeDto } from '../services/document-type.service';

@Controller('document-sequence/types')
@Roles(Role.SUPER_ADMIN, Role.CLINIC_OWNER)
export class DocumentTypeController {
  constructor(private readonly documentTypeService: DocumentTypeService) {}

  @Get()
  findAll(@TenantId() clinicId: string) {
    return this.documentTypeService.findAll(clinicId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId() clinicId: string,
    @Body() dto: CreateDocumentTypeDto,
  ) {
    return this.documentTypeService.create(clinicId, dto);
  }

  @Patch(':id')
  update(
    @TenantId() clinicId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.documentTypeService.update(clinicId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantId() clinicId: string,
    @Param('id') id: string,
  ) {
    return this.documentTypeService.remove(clinicId, id);
  }
}
