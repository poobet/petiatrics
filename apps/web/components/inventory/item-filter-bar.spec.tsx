import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemFilterBar from './item-filter-bar';
import type { ItemFilters } from './item-filter-bar';
import type { ItemCategoryResponse } from '@petiatrics/types';
import { ItemType } from '@petiatrics/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CATEGORIES: ItemCategoryResponse[] = [
  { id: 'cat-001', name: 'Medicine', code: 'MEDICINE', isActive: true },
  { id: 'cat-002', name: 'Service', code: 'SERVICE', isActive: true },
];

const DEFAULT_FILTERS: ItemFilters = {
  search: '',
  itemType: '',
  categoryId: '',
  includeInactive: false,
  controlledSubstance: false,
};

describe('ItemFilterBar', () => {
  it('renders search input, type select, category select, and checkboxes', () => {
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={() => {}} />,
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/all types/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/all categories/i)).toBeInTheDocument();
  });

  it('calls onChange with updated search when typing', () => {
    const onChange = vi.fn();
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={onChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'amox' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'amox' }),
    );
  });

  it('calls onChange when itemType is changed', () => {
    const onChange = vi.fn();
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={onChange} />,
    );
    fireEvent.change(screen.getByDisplayValue(/all types/i), {
      target: { value: ItemType.SERVICE },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ itemType: ItemType.SERVICE }),
    );
  });

  it('populates category dropdown with provided categories', () => {
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={() => {}} />,
    );
    expect(screen.getByText('Medicine')).toBeInTheDocument();
    expect(screen.getAllByText('Service').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onChange when includeInactive checkbox is toggled', () => {
    const onChange = vi.fn();
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={onChange} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /inactive/i });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ includeInactive: true }),
    );
  });

  it('calls onChange when controlledSubstance checkbox is toggled', () => {
    const onChange = vi.fn();
    render(
      <ItemFilterBar filters={DEFAULT_FILTERS} categories={CATEGORIES} onChange={onChange} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /controlled/i });
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ controlledSubstance: true }),
    );
  });

  it('preserves existing filters when a single field changes', () => {
    const onChange = vi.fn();
    const existing: ItemFilters = {
      ...DEFAULT_FILTERS,
      itemType: ItemType.STOCKED_GOOD,
      categoryId: 'cat-001',
    };
    render(
      <ItemFilterBar filters={existing} categories={CATEGORIES} onChange={onChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'drug' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'drug',
        itemType: ItemType.STOCKED_GOOD,
        categoryId: 'cat-001',
      }),
    );
  });
});
