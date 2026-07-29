import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaClient, ResetInterval, SequenceScope, DocumentModule } from '@prisma/client';

import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  defaultTemplate!: string;

  @IsEnum(ResetInterval)
  @IsOptional()
  defaultResetInterval?: ResetInterval;

  @IsEnum(SequenceScope)
  @IsOptional()
  scope?: SequenceScope;

  @IsEnum(DocumentModule)
  @IsOptional()
  module?: DocumentModule;
}

export class UpdateDocumentTypeDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  defaultTemplate?: string;

  @IsEnum(ResetInterval)
  @IsOptional()
  defaultResetInterval?: ResetInterval;

  @IsEnum(SequenceScope)
  @IsOptional()
  scope?: SequenceScope;

  @IsEnum(DocumentModule)
  @IsOptional()
  module?: DocumentModule;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

@Injectable()
export class DocumentTypeService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List all types visible to a clinic: system-wide + clinic-specific, optionally filtered by module */
  async findAll(clinicId: string, module?: DocumentModule) {
    return this.prisma.documentTypeDefinition.findMany({
      where: {
        OR: [{ clinicId: null }, { clinicId }],
        isActive: true,
        ...(module ? { module } : {}),
      },
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
    });
  }

  /** Create a new clinic-specific document type */
  async create(clinicId: string, dto: CreateDocumentTypeDto) {
    // Code must be unique within clinic scope
    const existing = await this.prisma.documentTypeDefinition.findFirst({
      where: { clinicId, code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Document type with code "${dto.code}" already exists for this clinic`);
    }
    // Cannot shadow a system type
    const systemConflict = await this.prisma.documentTypeDefinition.findFirst({
      where: { clinicId: null, code: dto.code.toUpperCase() },
    });
    if (systemConflict) {
      throw new ConflictException(`Cannot create a custom type with the same code as a system type: "${dto.code}"`);
    }

    return this.prisma.documentTypeDefinition.create({
      data: {
        clinicId,
        code: dto.code.toUpperCase().replace(/\s+/g, '_'),
        label: dto.label,
        defaultTemplate: dto.defaultTemplate,
        defaultResetInterval: dto.defaultResetInterval ?? ResetInterval.YEARLY,
        scope: dto.scope ?? SequenceScope.CLINIC,
        module: dto.module ?? DocumentModule.GENERAL,
        isSystem: false,
      },
    });
  }

  /** Update a clinic-specific (non-system) document type */
  async update(clinicId: string, id: string, dto: UpdateDocumentTypeDto) {
    const existing = await this.prisma.documentTypeDefinition.findFirst({
      where: { id, clinicId },
    });
    if (!existing) {
      throw new NotFoundException(`Document type ${id} not found`);
    }
    if (existing.isSystem) {
      throw new ForbiddenException('Cannot edit a system document type');
    }

    return this.prisma.documentTypeDefinition.update({
      where: { id },
      data: dto,
    });
  }

  /** Soft-delete (deactivate) a clinic-specific (non-system) document type */
  async remove(clinicId: string, id: string) {
    const existing = await this.prisma.documentTypeDefinition.findFirst({
      where: { id, clinicId },
    });
    if (!existing) {
      throw new NotFoundException(`Document type ${id} not found`);
    }
    if (existing.isSystem) {
      throw new ForbiddenException('Cannot delete a system document type');
    }

    return this.prisma.documentTypeDefinition.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
