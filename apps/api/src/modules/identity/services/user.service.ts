import {
  BadRequestException,
  ConflictException,
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

const BCRYPT_ROUNDS = 12;

/** Minimum password policy — applied both on invite and on password reset */
function assertPasswordPolicy(password: string): void {
  if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) throw new BadRequestException('Password must contain at least one uppercase letter.');
  if (!/[0-9]/.test(password)) throw new BadRequestException('Password must contain at least one digit.');
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

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

    // Generate a temporary password — in production this would be sent via email
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
      orderBy: { email: 'asc' },
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
}
