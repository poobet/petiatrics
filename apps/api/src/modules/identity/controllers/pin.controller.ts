import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsNumberString, IsString, IsUUID, Length } from 'class-validator';
import { PinVerificationService } from '../services/pin-verification.service';
import { CurrentUser } from '../../../common/decorators/tenant.decorator';
import { Role } from '@petiatrics/types';
import { Roles } from '../../../common/guards/roles.decorator';
import type { UserContext } from '@petiatrics/types';

const SUPERVISORS = [Role.CLINIC_OWNER, Role.VET];
const ALL_CLINIC_ROLES = [Role.CLINIC_OWNER, Role.VET, Role.ASSISTANT, Role.CASHIER, Role.STAFF];

export class VerifyPinDto {
  @IsUUID()
  supervisorUserId!: string;

  @IsNumberString()
  @Length(4, 8)
  pin!: string;
}

export class SetPinDto {
  @IsNumberString()
  @Length(4, 8)
  pin!: string;
}

@Controller('auth/pin')
export class PinController {
  constructor(private readonly pinService: PinVerificationService) {}

  /**
   * POST /auth/pin/verify
   * Called by the POS when a cashier needs a supervisor override.
   * Any authenticated clinic user can request a verification on behalf of a supervisor.
   */
  @Post('verify')
  @Roles(...ALL_CLINIC_ROLES)
  @HttpCode(HttpStatus.OK)
  verify(@CurrentUser() ctx: UserContext, @Body() dto: VerifyPinDto) {
    return this.pinService.verifyPin(ctx.clinicId!, dto.supervisorUserId, dto.pin);
  }

  /**
   * POST /auth/pin/set
   * Allows a supervisor to set their own PIN.
   */
  @Post('set')
  @Roles(...SUPERVISORS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPin(@CurrentUser() ctx: UserContext, @Body() dto: SetPinDto) {
    await this.pinService.setPin(ctx.userId, dto.pin);
  }

  /**
   * DELETE /auth/pin/:userId
   * Allows a CLINIC_OWNER to clear any user's PIN (e.g., when staff leaves).
   */
  @Delete(':userId')
  @Roles(Role.CLINIC_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearPin(@Param('userId') userId: string) {
    await this.pinService.clearPin(userId);
  }
}
