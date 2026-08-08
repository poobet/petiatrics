import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, GLAccountType } from '@prisma/client';
import { GlAccountService } from '../services/gl-account.service';
import { CreateGlAccountDto } from '../dto/create-gl-account.dto';

@Controller('accounting/gl-accounts')
export class GlAccountController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly glAccountService: GlAccountService,
  ) {}

  @Get()
  async findAll(
    @Query('type') type?: GLAccountType,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.gLAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  @Post()
  async create(@Body() dto: CreateGlAccountDto) {
    const existing = await this.prisma.gLAccount.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`GL Account code "${dto.code}" already exists.`);
    }

    return this.prisma.gLAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isSystem: false,
        isActive: true,
      },
    });
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.glAccountService.deactivateAccount(id);
  }
}
