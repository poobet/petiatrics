import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './services/auth.service';
import { ClinicService } from './services/clinic.service';
import { UserService } from './services/user.service';
import { BusinessPartnerService } from './services/business-partner.service';
import { PinVerificationService } from './services/pin-verification.service';
import { AuthController } from './controllers/auth.controller';
import { AdminController } from './controllers/admin.controller';
import { StaffController } from './controllers/staff.controller';
import { ClientsController } from './controllers/clients.controller';
import { BusinessPartnersController } from './controllers/business-partners.controller';
import { ReferenceController } from './controllers/reference.controller';
import { PinController } from './controllers/pin.controller';
import { BranchesController } from './controllers/branches.controller';
import { SessionModule } from '../../common/session/session.module';

/**
 * IdentityModule — US1: Staff Identity & Access Management
 *
 * Handles: user authentication (login/logout), session management,
 * RBAC, user CRUD for clinic admins, account lockout, password management,
 * and Business Partner master-data management.
 */
@Module({
  imports: [SessionModule],
  controllers: [AuthController, AdminController, StaffController, ClientsController, BusinessPartnersController, ReferenceController, PinController, BranchesController],
  providers: [
    // Provide a bare PrismaClient for identity operations (unscoped — admins need cross-clinic access)
    {
      provide: PrismaClient,
      useFactory: () => {
        const prisma = new PrismaClient();
        return prisma;
      },
    },
    AuthService,
    ClinicService,
    UserService,
    BusinessPartnerService,
    PinVerificationService,
  ],
  exports: [AuthService, UserService, BusinessPartnerService, PinVerificationService],
})
export class IdentityModule {}
