import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSystemRuleDto } from '../dto/create-system-rule.dto';
import { UpdateSystemRuleDto } from '../dto/update-system-rule.dto';

@Injectable()
export class SystemRuleService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateSystemRuleDto) {
    return this.prisma.systemRule.create({
      data: {
        clinicId: dto.clinicId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        eventType: dto.eventType,
        priority: dto.priority ?? 0,
        conditions: dto.conditions as any,
        action: dto.action as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(filters?: { eventType?: string; clinicId?: string }) {
    const where: any = {};
    if (filters?.eventType) where.eventType = filters.eventType;
    if (filters?.clinicId) {
      where.OR = [
        { clinicId: filters.clinicId },
        { clinicId: null },
      ];
    }

    return this.prisma.systemRule.findMany({
      where,
      orderBy: { priority: 'desc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.systemRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`SystemRule ${id} not found`);
    return rule;
  }

  async update(id: string, dto: UpdateSystemRuleDto) {
    await this.findOne(id); // throws if not found
    return this.prisma.systemRule.update({
      where: { id },
      data: {
        ...(dto.clinicId !== undefined && { clinicId: dto.clinicId ?? null }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions as any }),
        ...(dto.action !== undefined && { action: dto.action as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // throws if not found
    return this.prisma.systemRule.delete({ where: { id } });
  }
}
