import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, ResetInterval, SequenceScope } from '@prisma/client';

import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class UpsertSequenceConfigDto {
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @IsString()
  @IsNotEmpty()
  template!: string;

  @IsEnum(ResetInterval)
  @IsNotEmpty()
  resetInterval!: ResetInterval;

  @IsEnum(SequenceScope)
  @IsOptional()
  scope?: SequenceScope;
}

export class UpdateSequenceConfigDto {
  @IsString()
  @IsOptional()
  template?: string;

  @IsEnum(ResetInterval)
  @IsOptional()
  resetInterval?: ResetInterval;

  @IsEnum(SequenceScope)
  @IsOptional()
  scope?: SequenceScope;
}

@Injectable()
export class SequenceConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List all sequence configs for a clinic */
  async findAll(clinicId: string) {
    return this.prisma.documentSequenceConfig.findMany({
      where: { clinicId },
      orderBy: { documentType: 'asc' },
    });
  }

  /** Upsert a config for a document type */
  async upsert(clinicId: string, dto: UpsertSequenceConfigDto) {
    return this.prisma.documentSequenceConfig.upsert({
      where: {
        clinicId_documentType: { clinicId, documentType: dto.documentType },
      },
      create: {
        clinicId,
        documentType: dto.documentType,
        template: dto.template,
        resetInterval: dto.resetInterval,
        scope: dto.scope ?? SequenceScope.CLINIC,
      },
      update: {
        template: dto.template,
        resetInterval: dto.resetInterval,
        scope: dto.scope,
      },
    });
  }

  /** Update fields of an existing config */
  async update(clinicId: string, id: string, dto: UpdateSequenceConfigDto) {
    const existing = await this.prisma.documentSequenceConfig.findFirst({
      where: { id, clinicId },
    });
    if (!existing) {
      throw new NotFoundException(`Sequence config ${id} not found`);
    }
    return this.prisma.documentSequenceConfig.update({
      where: { id },
      data: dto,
    });
  }

  /** Delete a config (reverts to default template from DocumentTypeDefinition) */
  async remove(clinicId: string, id: string) {
    const existing = await this.prisma.documentSequenceConfig.findFirst({
      where: { id, clinicId },
    });
    if (!existing) {
      throw new NotFoundException(`Sequence config ${id} not found`);
    }
    return this.prisma.documentSequenceConfig.delete({ where: { id } });
  }
}
