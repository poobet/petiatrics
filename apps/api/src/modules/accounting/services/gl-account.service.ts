import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaClient, GLAccountType } from '@prisma/client';
import { CreateGlAccountDto } from '../dto/create-gl-account.dto';

export interface GetGlAccountsFilter {
  type?: GLAccountType;
  isActive?: boolean;
  search?: string;
}

@Injectable()
export class GlAccountService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates a new user-defined GL account (isSystem is forced to false).
   */
  async createAccount(dto: CreateGlAccountDto) {
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

  /**
   * Lists GL accounts with optional category, status, and search filters.
   */
  async getAccounts(filter?: GetGlAccountsFilter) {
    const where: any = {};

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search) {
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.gLAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Deactivates (soft-deletes) a GL Account by ID enforcing strict hybrid COA deletion rules.
   *
   * Business Rules:
   * 1. If the GL Account does not exist, throws NotFoundException.
   * 2. If isSystem === true (Protected System Account): Cannot be deleted or deactivated under any circumstances. Throws ForbiddenException.
   * 3. If isSystem === false (User-Defined Account): Soft-deleted by updating isActive = false (preserving audit trail).
   */
  async deactivateAccount(id: string) {
    const account = await this.prisma.gLAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`GL Account with ID "${id}" was not found.`);
    }

    if (account.isSystem) {
      throw new ForbiddenException(
        `System account "${account.code} - ${account.name}" is a protected control account required for perpetual inventory and cannot be deleted or deactivated under any circumstances.`
      );
    }

    return this.prisma.gLAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Alias for deactivateAccount to handle DELETE endpoints while preventing hard-deletion.
   */
  async deleteAccount(id: string) {
    return this.deactivateAccount(id);
  }
}
