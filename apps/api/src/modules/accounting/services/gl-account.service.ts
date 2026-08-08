import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class GlAccountService {
  constructor(private readonly prisma: PrismaClient) {}

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
