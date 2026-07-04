import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaClient, User } from '@prisma/client';
import { Role, UserStatus } from '@petiatrics/types';
import { v4 as uuidv4 } from 'uuid';
import { RegisterCustomerDto } from '../dto/register-customer.dto';
import { CreateClientDto } from '../dto/create-client.dto';
import { DEFAULT_ROLE_PERMISSIONS } from './auth.service';

export interface InviteUserDto {
  email: string;
  role: Role;
  clinicId: string;
  invitedBy: string;
}

export interface UpdateUserRoleDto {
  role: Role;
}

export interface CreateStaffInput {
  usernamePrefix: string;
  clinicSlug: string;
  clinicId: string;
  name: string;
  temporaryPassword: string;
  role: Role;
  branchIds?: string[];
}

const BCRYPT_ROUNDS = 12;

function assertPasswordPolicy(password: string): void {
  if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) throw new BadRequestException('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password)) throw new BadRequestException('Password must contain at least one digit.');
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * US4: Create a new staff member with username@clinicSlug identity.
   * Sets mustChangePassword=true so they must change temporary password on first login.
   */
  async createStaff(input: CreateStaffInput): Promise<User & { username: string }> {
    const username = `${input.usernamePrefix}@${input.clinicSlug}`;

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException(`Username ${username} is already taken.`);
    }

    assertPasswordPolicy(input.temporaryPassword);
    const passwordHash = await bcrypt.hash(input.temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          name: input.name,
          passwordHash,
          role: input.role as any,
          clinicId: input.clinicId,
          status: UserStatus.ACTIVE as any,
          mustChangePassword: true,
        },
      });

      if (input.branchIds && input.branchIds.length > 0) {
        await tx.userBranch.createMany({
          data: input.branchIds.map((branchId) => ({ userId: u.id, branchId })),
          skipDuplicates: true,
        });
      }

      if (input.role === Role.CUSTOMER || input.role === ('CUSTOMER' as any)) {
        await this.createCustomerBpWithCode(tx, u.id, input.clinicId, input.name, null);
      } else {
        // Auto-create a STAFF or VET BusinessPartner linked to the new staff user
        await this.createStaffBpWithCode(tx, u.id, input.clinicId, input.name, input.role);
      }

      return u;
    });

    return user as User & { username: string };
  }

  /**
   * Invite a new staff member. Creates an INVITED user with a temporary
   * random password (hashed). A real implementation would send an email.
   */
  async invite(dto: InviteUserDto): Promise<User & { temporaryPassword: string }> {
    const emailNorm = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({ where: { email: emailNorm } });
    if (existing) {
      throw new ConflictException(`User ${emailNorm} already exists.`);
    }

    const temporaryPassword = uuidv4().slice(0, 12) + 'A1!';
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: emailNorm,
          passwordHash,
          role: dto.role as unknown as any,
          clinicId: dto.clinicId,
          invitedBy: dto.invitedBy,
          status: UserStatus.INVITED as unknown as any,
        },
      });

      if (dto.role === Role.CUSTOMER || dto.role === ('CUSTOMER' as any)) {
        await this.createCustomerBpWithCode(tx, u.id, dto.clinicId, emailNorm.split('@')[0], emailNorm);
      }

      return u;
    });

    return { ...user, temporaryPassword };
  }

  async findByClinic(clinicId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { clinicId, role: { not: 'CUSTOMER' as any } },
      include: {
        businessPartners: {
          where: { clinicId },
          select: { id: true, code: true, type: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  async updateRole(id: string, clinicId: string, dto: UpdateUserRoleDto): Promise<User> {
    await this.findOneInClinic(id, clinicId);
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role as unknown as any },
    });
  }

  async deactivate(id: string, clinicId: string): Promise<User> {
    await this.findOneInClinic(id, clinicId);
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE as unknown as any },
    });
  }

  async changePassword(
    id: string,
    currentPasswordHash: string,
    newPassword: string,
  ): Promise<void> {
    assertPasswordPolicy(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, status: UserStatus.ACTIVE as unknown as any },
    });
  }

  /**
   * Admin-initiated password reset for a staff member.
   * Sets mustChangePassword=true so the staff must set a new password on next login.
   */
  async adminResetPassword(id: string, clinicId: string, newPassword: string): Promise<{ ok: true }> {
    assertPasswordPolicy(newPassword);
    await this.findOneInClinic(id, clinicId);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: UserStatus.ACTIVE as unknown as any,
      },
    });
    return { ok: true };
  }

  private async findOneInClinic(id: string, clinicId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: { id, clinicId } });
    if (!user) throw new NotFoundException(`User ${id} not found in clinic.`);
    return user;
  }

  /**
   * Link a user to an existing Business Partner.
   * Both must belong to the same clinic. The user must not already be linked to another BP.
   */
  async linkToBusinessPartner(userId: string, businessPartnerId: string, clinicId: string): Promise<User> {
    const user = await this.findOneInClinic(userId, clinicId);
    
    const bp = await this.prisma.businessPartner.findFirst({
      where: { id: businessPartnerId, clinicId },
    });
    if (!bp) throw new NotFoundException('Business Partner not found in this clinic');

    const existingBpForUser = await this.prisma.businessPartner.findFirst({
      where: { clinicId, linkedUserId: userId },
    });
    if (existingBpForUser && existingBpForUser.id !== businessPartnerId) {
      throw new ConflictException('User is already linked to another Business Partner in this clinic');
    }

    await this.prisma.businessPartner.update({
      where: { id: businessPartnerId },
      data: { linkedUserId: userId },
    });

    return user;
  }

  /**
   * Remove a user's Business Partner linkage.
   */
  async unlinkFromBusinessPartner(userId: string, clinicId: string): Promise<User> {
    const user = await this.findOneInClinic(userId, clinicId);
    await this.prisma.businessPartner.updateMany({
      where: { clinicId, linkedUserId: userId },
      data: { linkedUserId: null },
    });
    return user;
  }

  /**
   * Transactional helper to auto-generate a sequenced BusinessPartner of type STAFF or VET
   * and link it to the given user. VET role → BpType VET (prefix 'V-'); all others → STAFF (prefix 'S-').
   */
  private async createStaffBpWithCode(
    tx: any,
    userId: string,
    clinicId: string,
    name: string,
    role: Role,
  ): Promise<any> {
    const isVet = role === Role.VET;
    const bpType = isVet ? 'VET' : 'STAFF';
    const prefix = isVet ? 'V-' : 'S-';

    const group = await tx.bpGroup.findFirst({
      where: { clinicId, prefix },
    });

    let generatedCode: string | null = null;
    if (group) {
      const rows = await tx.$queryRaw`SELECT id, prefix, "currentSequence" FROM bp_groups WHERE id = ${group.id} FOR UPDATE`;
      const lockedGroup = rows[0];
      if (lockedGroup) {
        const newSeq = lockedGroup.currentSequence + 1;
        await tx.bpGroup.update({
          where: { id: group.id },
          data: { currentSequence: newSeq },
        });
        generatedCode = `${lockedGroup.prefix}${newSeq.toString().padStart(4, '0')}`;
      }
    }

    const bp = await tx.businessPartner.create({
      data: {
        clinicId,
        type: bpType,
        name,
        code: generatedCode,
        groupId: group?.id ?? null,
        linkedUserId: userId,
        isActive: true,
      },
    });

    // For VET BPs, create the extension row (license number filled in later)
    if (isVet) {
      await tx.bpVet.create({
        data: { bpId: bp.id, licenseNumber: '' },
      });
    }

    return bp;
  }

  /**
   * Transactional helper to auto-generate a sequenced BusinessPartner of type CUSTOMER
   * and link it to the given user.
   */
  async createCustomerBpWithCode(
    tx: any,
    userId: string,
    clinicId: string,
    name: string,
    email?: string | null,
  ): Promise<any> {
    const group = await tx.bpGroup.findFirst({
      where: { clinicId, prefix: 'C-' },
    });

    let generatedCode: string | null = null;
    if (group) {
      const rows = await tx.$queryRaw`SELECT id, prefix, "currentSequence" FROM bp_groups WHERE id = ${group.id} FOR UPDATE`;
      const lockedGroup = rows[0];
      if (lockedGroup) {
        const newSeq = lockedGroup.currentSequence + 1;
        await tx.bpGroup.update({
          where: { id: group.id },
          data: { currentSequence: newSeq },
        });
        generatedCode = `${lockedGroup.prefix}${newSeq.toString().padStart(4, '0')}`;
      }
    }

    return tx.businessPartner.create({
      data: {
        clinicId,
        type: 'CUSTOMER',
        name,
        email: email ?? null,
        code: generatedCode,
        groupId: group?.id ?? null,
        linkedUserId: userId,
        isActive: true,
      },
    });
  }

  /**
   * B2C Self-Registration: Creates a Customer User and their BusinessPartner record
   * atomically in a transaction.
   */
  async registerCustomer(dto: RegisterCustomerDto): Promise<User> {
    const emailNorm = dto.email.toLowerCase().trim();
    
    const [existingClinic, existingUser] = await Promise.all([
      this.prisma.clinic.findUnique({ where: { id: dto.clinicId } }),
      this.prisma.user.findFirst({ where: { email: emailNorm } }),
    ]);
    
    if (!existingClinic) throw new NotFoundException(`Clinic ${dto.clinicId} not found.`);
    if (existingUser) throw new ConflictException(`An account with this email already exists.`);

    assertPasswordPolicy(dto.password);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: emailNorm,
          name: dto.name,
          passwordHash,
          role: Role.CUSTOMER as any,
          clinicId: dto.clinicId,
          status: UserStatus.ACTIVE as any,
        },
      });

      await this.createCustomerBpWithCode(tx, u.id, dto.clinicId, dto.name, emailNorm);

      return u;
    });
  }

  /**
   * Get all custom role permissions for the clinic.
   */
  async getRolePermissions(clinicId: string): Promise<any[]> {
    return this.prisma.clinicRolePermission.findMany({
      where: { clinicId },
    });
  }

  /**
   * Update permissions for a specific role in the clinic.
   */
  async updateRolePermissions(clinicId: string, role: Role, permissions: string[]): Promise<any> {
    return this.prisma.clinicRolePermission.upsert({
      where: {
        clinicId_role: {
          clinicId,
          role: role as any,
        },
      },
      update: { permissions },
      create: {
        clinicId,
        role: role as any,
        permissions,
      },
    });
  }

  async findClientsByClinic(clinicId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        clinicId,
        role: Role.CUSTOMER as any,
      },
      include: {
        businessPartners: {
          where: { clinicId },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as any;
  }

  async findClientById(clinicId: string, id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        clinicId,
        role: Role.CUSTOMER as any,
      },
      include: {
        businessPartners: {
          where: { clinicId },
        },
      },
    });
    if (!user) throw new NotFoundException(`Client ${id} not found in this clinic.`);
    return user as any;
  }

  async createClient(clinicId: string, dto: CreateClientDto): Promise<User> {
    let emailNorm: string | null = null;
    if (dto.email) {
      emailNorm = dto.email.toLowerCase().trim();
      const existingUser = await this.prisma.user.findFirst({ where: { email: emailNorm } });
      if (existingUser) {
        throw new ConflictException(`An account with email ${dto.email} already exists.`);
      }
    }

    const temporaryPassword = uuidv4().slice(0, 12) + 'A1!';
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: emailNorm,
          name: dto.name,
          passwordHash,
          role: Role.CUSTOMER as any,
          clinicId: clinicId,
          status: UserStatus.ACTIVE as any,
        },
      });

      const bp = await this.createCustomerBpWithCode(tx, u.id, clinicId, dto.name, emailNorm);

      await tx.businessPartner.update({
        where: { id: bp.id },
        data: {
          phone: dto.phone ?? null,
          taxId: dto.taxId ?? null,
          addressLine1: dto.addressLine1 ?? null,
          subDistrict: dto.subDistrict ?? null,
          district: dto.district ?? null,
          province: dto.province ?? null,
          zipcode: dto.zipcode ?? null,
          lineId: dto.lineId ?? null,
        },
      });

      return tx.user.findUnique({
        where: { id: u.id },
        include: {
          businessPartners: {
            where: { clinicId },
          },
        },
      });
    }) as any;
  }
}
