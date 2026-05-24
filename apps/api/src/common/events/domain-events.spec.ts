import { LowStockEvent, VisitFinalizedEvent } from './domain-events';

describe('domain event contracts', () => {
  it('VisitFinalizedEvent carries branchId before finalizedAt', () => {
    const event = new VisitFinalizedEvent(
      'clinic-1',
      'visit-1',
      'patient-1',
      'vet-1',
      'branch-1',
      new Date('2026-05-17T10:00:00.000Z'),
      ['product-1'],
    );

    expect(event.branchId).toBe('branch-1');
    expect(event.productIds).toEqual(['product-1']);
  });

  it('LowStockEvent carries branchId for branch-scoped alerts', () => {
    const event = new LowStockEvent('clinic-1', 'branch-1', 'product-1', 'Drug', 2, 5);
    expect(event.branchId).toBe('branch-1');
    expect(event.currentQuantity).toBe(2);
  });
});
