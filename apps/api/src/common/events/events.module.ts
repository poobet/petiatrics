/**
 * EventsModule re-exports the NestJS EventEmitterModule so bounded-context
 * modules only need to import EventsModule instead of repeating the EventEmitterModule
 * registration.  The domain event DTOs live in domain-events.ts.
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

export { VisitFinalizedEvent, LowStockEvent, InvoiceCreatedEvent, InvoicePaidEvent, GoodsReceiptCompletedEvent, GoodsIssuedEvent } from './domain-events';

@Module({
  imports: [EventEmitterModule],
  exports: [EventEmitterModule],
})
export class EventsModule {}
