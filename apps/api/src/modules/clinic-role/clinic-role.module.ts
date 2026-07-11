import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClinicRoleController, ClinicPagesController } from './clinic-role.controller';
import { ClinicRoleService } from './clinic-role.service';

@Module({
  controllers: [ClinicRoleController, ClinicPagesController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    ClinicRoleService,
  ],
  exports: [ClinicRoleService],
})
export class ClinicRoleModule {}
