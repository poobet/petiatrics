import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemTable from './item-table';
import { ItemType } from '@petiatrics/types';
import type { ItemSummaryResponse } from '@petiatrics/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<ItemSummaryResponse> = {}): ItemSummaryResponse {
  return {
    id: 'prod-001',
    code: 'MED-001',
    sku: 'SKU-00001',
    barcode: null,
    name: 'Test Medication',
    itemType: ItemType.INVENTORY,
    isActive: true,
    standardCost: 80,
    baseSellingPrice: 150,
    isTaxInclusive: false,
    isControlledSubstance: false,
    requiresBatchAndExpiryTracking: false,
    category: { id: 'cat-001', name: 'Medicine' },
    baseUnit: { id: 'unit-001', name: 'Box', symbol: 'bx' },
    defaultTaxCode: null,
    defaultSupplier: null,
    ...overrides,
  };
}

describe('ItemTable', () => {
  it('renders empty state when items list is empty', () => {
    render(<ItemTable items={[]} lowStockIds={new Set()} onDeactivate={() => {}} />);
    expect(screen.getByText(/no items found/i)).toBeInTheDocument();
  });

  it('renders item code, name, and type', () => {
    const item = makeItem();
    render(<ItemTable items={[item]} lowStockIds={new Set()} onDeactivate={() => {}} />);
    expect(screen.getByText('MED-001')).toBeInTheDocument();
    expect(screen.getByText('Test Medication')).toBeInTheDocument();
    expect(screen.getByText(/stocked/i)).toBeInTheDocument();
  });

  it('shows category and base unit', () => {
    const item = makeItem();
    render(<ItemTable items={[item]} lowStockIds={new Set()} onDeactivate={() => {}} />);
    expect(screen.getByText('Medicine')).toBeInTheDocument();
    expect(screen.getByText('Box')).toBeInTheDocument();
  });

  it('shows low-stock warning icon when item is in lowStockIds', () => {
    const item = makeItem({ id: 'low-item' });
    const { container } = render(
      <ItemTable items={[item]} lowStockIds={new Set(['low-item'])} onDeactivate={() => {}} />,
    );
    expect(container.querySelector('[title="Low stock"]')).toBeInTheDocument();
  });

  it('does not show low-stock icon for non-low items', () => {
    const item = makeItem({ id: 'normal-item' });
    const { container } = render(
      <ItemTable items={[item]} lowStockIds={new Set()} onDeactivate={() => {}} />,
    );
    expect(container.querySelector('[title="Low stock"]')).not.toBeInTheDocument();
  });

  it('calls onDeactivate with item id when deactivate button is clicked', () => {
    const onDeactivate = vi.fn();
    const item = makeItem();
    render(<ItemTable items={[item]} lowStockIds={new Set()} onDeactivate={onDeactivate} />);
    const deactivateBtn = screen.getByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateBtn);
    expect(onDeactivate).toHaveBeenCalledWith('prod-001');
  });

  it('shows dash for qty on SERVICE items', () => {
    const service = makeItem({ itemType: ItemType.SERVICE });
    render(<ItemTable items={[service]} lowStockIds={new Set()} onDeactivate={() => {}} />);
    const cells = screen.getAllByRole('cell');
    const qtyCellText = cells.find((c) => c.textContent === '—')?.textContent;
    expect(qtyCellText).toBe('—');
  });

  it('renders multiple items', () => {
    const items = [makeItem({ id: 'p1', code: 'MED-001' }), makeItem({ id: 'p2', code: 'SVC-001', itemType: ItemType.SERVICE })];
    render(<ItemTable items={items} lowStockIds={new Set()} onDeactivate={() => {}} />);
    expect(screen.getByText('MED-001')).toBeInTheDocument();
    expect(screen.getByText('SVC-001')).toBeInTheDocument();
  });
});
