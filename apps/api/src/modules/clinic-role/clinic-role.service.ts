import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class ClinicRoleService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List all active roles for a clinic */
  async listRoles(clinicId: string) {
    return this.prisma.clinicRole.findMany({
      where: { clinicId, isActive: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        isSystem: true,
        isDeletable: true,
        _count: { select: { users: true } },
      },
    });
  }

  /** Create a custom clinic role */
  async createRole(clinicId: string, dto: CreateRoleDto) {
    // Generate code from name: "Senior Nurse" → "CUSTOM_SENIOR_NURSE"
    const code = 'CUSTOM_' + dto.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

    const existing = await this.prisma.clinicRole.findUnique({
      where: { clinicId_code: { clinicId, code } },
    });
    if (existing) {
      throw new BadRequestException(`A role with this name already exists.`);
    }

    return this.prisma.clinicRole.create({
      data: {
        clinicId,
        code,
        name: dto.name,
        isSystem: false,
        isDeletable: true,
        isActive: true,
      },
    });
  }

  /** Rename a role (name only — code never changes) */
  async renameRole(clinicId: string, roleId: string, name: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('System roles cannot be renamed');

    return this.prisma.clinicRole.update({
      where: { id: roleId },
      data: { name },
    });
  }

  /** Delete a role — blocked if isDeletable=false or users exist */
  async deleteRole(clinicId: string, roleId: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.isDeletable) {
      throw new BadRequestException('This role is a system role and cannot be deleted.');
    }

    const userCount = await this.prisma.user.count({
      where: { roleId },
    });
    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${userCount} user(s) still assigned to this role. Reassign them first.`,
      );
    }

    await this.prisma.clinicRole.delete({ where: { id: roleId } });
    return { deleted: true };
  }

  /** Get all permissions for a role */
  async getRolePermissions(clinicId: string, roleId: string) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const perms = await this.prisma.clinicRolePermissionV2.findMany({
      where: { roleId },
      include: {
        page: { select: { code: true, name: true } },
        action: { select: { code: true, name: true } },
      },
    });

    return perms.map((p) => ({
      pageCode: p.page.code,
      pageName: p.page.name,
      actionCode: p.action?.code ?? null,
      actionName: p.action?.name ?? null,
    }));
  }

  /** Replace the full permission set for a role */
  async setRolePermissions(clinicId: string, roleId: string, actionCodes: string[]) {
    const role = await this.prisma.clinicRole.findFirst({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (!role.isDeletable && role.code === 'CLINIC_OWNER') {
      throw new BadRequestException('Clinic Owner permissions cannot be modified.');
    }

    // Validate all action codes exist
    const actions = await this.prisma.actionMaster.findMany({
      where: { code: { in: actionCodes }, isActive: true },
    });
    if (actions.length !== actionCodes.length) {
      const foundCodes = actions.map((a) => a.code);
      const invalid = actionCodes.filter((c) => !foundCodes.includes(c));
      throw new BadRequestException(`Invalid action codes: ${invalid.join(', ')}`);
    }

    // Replace all permissions in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.clinicRolePermissionV2.deleteMany({ where: { roleId } });
      for (const action of actions) {
        await tx.clinicRolePermissionV2.create({
          data: { roleId, pageId: action.pageId, actionId: action.id },
        });
      }
    });

    return this.getRolePermissions(clinicId, roleId);
  }

  /** List all pages + actions (for permission matrix UI) */
  async listPagesWithActions() {
    const pages = await this.prisma.pageMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        actions: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, code: true, name: true, description: true },
        },
      },
    });
    return pages;
  }
}
