import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import ItemForm from './item-form';
import { ItemType } from '@petiatrics/types';
import type { ItemFormReferenceData } from './item-form-types';

// ─── Mock next/navigation ─────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

// ─── Mock api-client ──────────────────────────────────────────────────────────

vi.mock('../../lib/api-client', () => ({
  apiClient: { post: vi.fn(), patch: vi.fn(), get: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(public readonly body: unknown, message: string) { super(message); }
  },
}));

import { apiClient } from '../../lib/api-client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REFS: ItemFormReferenceData = {
  categories: [{ id: 'cat-001', name: 'Medicine', code: 'MEDICINE', isActive: true, revenueGlAccountId: null, expenseGlAccountId: null, revenueGlAccount: null, expenseGlAccount: null }],
  units: [{ id: 'unit-001', name: 'Piece', symbol: 'pc', isActive: true }],
  taxCodes: [{ id: 'tc-001', name: 'VAT 7%', code: 'VAT7' }],
  suppliers: [],
};

const EXISTING_ITEM = {
  id: 'prod-001',
  clinicId: 'clinic-001',
  code: 'MED-001',
  name: 'Test Drug',
  itemType: ItemType.INVENTORY,
  isActive: true,
  categoryId: 'cat-001',
  baseUnitId: 'unit-001',
  standardCost: 80,
  baseSellingPrice: 150,
  isTaxInclusive: false,
  isControlledSubstance: false,
  requiresBatchAndExpiryTracking: false,
  genericName: null,
  defaultTaxCodeId: null,
  defaultSupplierId: null,
  defaultDoctorFee: null,
  quantity: 50,
  reorderPoint: 10,
  minimumStock: 5,
  sku: 'SKU-00001',
  barcode: null,
  conversions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ItemForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' });
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  });

  describe('Tab navigation', () => {
    it('renders four tabs', () => {
      render(<ItemForm refs={REFS} />);
      expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /units/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pricing/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clinic/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /stock/i })).not.toBeInTheDocument();
    });

    it('shows stock tab in edit mode only', () => {
      render(<ItemForm refs={REFS} initial={EXISTING_ITEM as any} />);
      expect(screen.getByRole('button', { name: /stock/i })).toBeInTheDocument();
    });

    it('shows general tab content by default', () => {
      render(<ItemForm refs={REFS} />);
      expect(screen.getByLabelText(/item code/i)).toBeInTheDocument();
    });

    it('switches to pricing tab on click', () => {
      render(<ItemForm refs={REFS} />);
      fireEvent.click(screen.getByRole('button', { name: /pricing/i }));
      expect(screen.getByLabelText(/base selling price/i)).toBeInTheDocument();
    });

    it('preserves form values when switching tabs', () => {
      render(<ItemForm refs={REFS} />);
      fireEvent.change(screen.getByLabelText(/item code/i), { target: { value: 'MYCODE' } });
      fireEvent.click(screen.getByRole('button', { name: /pricing/i }));
      fireEvent.click(screen.getByRole('button', { name: /general/i }));
      expect(screen.getByLabelText(/item code/i)).toHaveValue('MYCODE');
    });
  });

  describe('Validation', () => {
    it('shows validation error when submitting with empty code', async () => {
      render(<ItemForm refs={REFS} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create item/i }));
      });
      expect(screen.getByText(/item code is required/i)).toBeInTheDocument();
    });

    it('shows validation error when submitting with empty name', async () => {
      render(<ItemForm refs={REFS} />);
      fireEvent.change(screen.getByLabelText(/item code/i), { target: { value: 'MED-001' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create item/i }));
      });
      expect(screen.getByText(/item name is required/i)).toBeInTheDocument();
    });

    it('does not call api when form has errors', async () => {
      render(<ItemForm refs={REFS} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create item/i }));
      });
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('Create mode', () => {
    it('calls apiClient.post on valid submission', async () => {
      render(<ItemForm refs={REFS} />);
      // Fill required fields
      fireEvent.change(screen.getByLabelText(/item code/i), { target: { value: 'MED-001' } });
      fireEvent.change(screen.getByLabelText(/item name/i), { target: { value: 'Test Drug' } });

      fireEvent.click(screen.getByRole('button', { name: /units/i }));
      fireEvent.change(screen.getByLabelText(/base unit/i), { target: { value: 'unit-001' } });

      fireEvent.click(screen.getByRole('button', { name: /general/i }));
      fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'cat-001' } });

      fireEvent.click(screen.getByRole('button', { name: /pricing/i }));
      fireEvent.change(screen.getByLabelText(/standard cost/i), { target: { value: '80' } });
      fireEvent.change(screen.getByLabelText(/base selling price/i), { target: { value: '150' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /create item/i }));
      });
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/inventory/products'),
        expect.objectContaining({ code: 'MED-001', name: 'Test Drug' }),
      );
    });
  });

  describe('Edit mode', () => {
    it('pre-fills fields from initial data', () => {
      render(<ItemForm refs={REFS} initial={EXISTING_ITEM as any} />);
      expect(screen.getByDisplayValue('MED-001')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Drug')).toBeInTheDocument();
    });

    it('disables item code field in edit mode', () => {
      render(<ItemForm refs={REFS} initial={EXISTING_ITEM as any} />);
      expect(screen.getByLabelText(/item code/i)).toBeDisabled();
    });

    it('loads stock balances when stock tab is selected in edit mode', async () => {
      render(<ItemForm refs={REFS} initial={EXISTING_ITEM as any} />);
      fireEvent.click(screen.getByRole('button', { name: /stock/i }));
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining('/inventory/stock-balances?productId=prod-001'));
      });
    });

    it('calls apiClient.patch on save', async () => {
      render(<ItemForm refs={REFS} initial={EXISTING_ITEM as any} />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
      });
      expect(apiClient.patch).toHaveBeenCalledWith(
        expect.stringContaining('/prod-001'),
        expect.any(Object),
      );
    });
  });
});
