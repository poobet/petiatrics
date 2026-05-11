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

    const user = await this.prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        role: dto.role as unknown as any,
        clinicId: dto.clinicId,
        invitedBy: dto.invitedBy,
        status: UserStatus.INVITED as unknown as any,
      },
    });

    return { ...user, temporaryPassword };
  }

  async findByClinic(clinicId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'asc' },
    });
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
    if (user.businessPartnerId && user.businessPartnerId !== businessPartnerId) {
      throw new ConflictException('User is already linked to another Business Partner');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { businessPartnerId },
    });
  }

  /**
   * Remove a user's Business Partner linkage.
   */
  async unlinkFromBusinessPartner(userId: string, clinicId: string): Promise<User> {
    await this.findOneInClinic(userId, clinicId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { businessPartnerId: null },
    });
  }
}
