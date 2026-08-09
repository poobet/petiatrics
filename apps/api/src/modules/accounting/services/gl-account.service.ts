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
   * Creates a new user-defined GL account scoped to the clinic (isSystem is forced to false).
   */
  async createAccount(clinicId: string, dto: CreateGlAccountDto) {
    const existing = await this.prisma.gLAccount.findFirst({
      where: {
        code: dto.code,
        OR: [{ clinicId: null }, { clinicId }],
      },
    });

    if (existing) {
      throw new ConflictException(`GL Account code "${dto.code}" already exists.`);
    }

    return this.prisma.gLAccount.create({
      data: {
        clinicId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isSystem: false,
        isActive: true,
      },
    });
  }

  /**
   * Lists GL accounts visible to a clinic (global system control accounts + clinic-specific accounts).
   */
  async getAccounts(clinicId?: string, filter?: GetGlAccountsFilter) {
    const andConditions: any[] = [];

    if (clinicId) {
      andConditions.push({
        OR: [{ clinicId: null }, { clinicId }],
      });
    }

    if (filter?.type) {
      andConditions.push({ type: filter.type });
    }

    if (filter?.isActive !== undefined) {
      andConditions.push({ isActive: filter.isActive });
    }

    if (filter?.search) {
      andConditions.push({
        OR: [
          { code: { contains: filter.search, mode: 'insensitive' } },
          { name: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

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
  async deactivateAccount(clinicId: string, id: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: {
        id,
        OR: [{ clinicId: null }, { clinicId }],
      },
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
  async deleteAccount(clinicId: string, id: string) {
    return this.deactivateAccount(clinicId, id);
  }
}
