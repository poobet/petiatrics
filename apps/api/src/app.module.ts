import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { SessionModule } from './common/session/session.module';
import { SessionGuard } from './common/session/session.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ContractValidationMiddleware } from './common/middleware/contract-validation.middleware';
import { IdentityModule } from './modules/identity/identity.module';
import { ClinicalModule } from './modules/clinical/clinical.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BillingModule } from './modules/billing/billing.module';
import { AuditModule } from './modules/audit/audit.module';
import { ProcurementModule } from './modules/procurement/procurement.module';

// Bounded-context modules are imported in their respective phases

@Module({
  imports: [
    // Environment configuration — available everywhere via ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Domain event bus — used for cross-context integration (VisitFinalized, LowStock)
    EventEmitterModule.forRoot({
      // Throw on unhandled events in test to catch missing listeners early
      ignoreErrors: false,
    }),

    // API-level rate limiting — per-IP, 100 req/min by default
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute window
        limit: 100,
      },
    ]),

    // MongoDB connection — used by ClinicalModule, AuditModule
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),

    // Global session management (Redis-backed)
    SessionModule,

    // Feature modules
    IdentityModule,
    ClinicalModule,
    AppointmentsModule,
    InventoryModule,
    BillingModule,
    AuditModule,
    ProcurementModule,
  ],
  providers: [
    // Rate limiting guard applied globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Session authentication applied globally (routes can opt-out via @Public())
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    // Granular permissions authorization applied globally
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    // Wrap all error responses in the standard { data, meta, error } envelope
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Wrap all successful responses in the standard { data, meta, error } envelope
    {
      provide: APP_INTERCEPTOR,
      useClass: EnvelopeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContractValidationMiddleware).forRoutes('*');
  }
}
