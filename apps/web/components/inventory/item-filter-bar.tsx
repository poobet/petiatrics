'use client';

import { ItemType } from '@petiatrics/types';
import type { ItemCategoryResponse } from '@petiatrics/types';

export interface ItemFilters {
  search: string;
  itemType: string;
  categoryId: string;
  includeInactive: boolean;
  controlledSubstance: boolean;
}

interface Props {
  filters: ItemFilters;
  categories: ItemCategoryResponse[];
  onChange: (filters: ItemFilters) => void;
}

export default function ItemFilterBar({ filters, categories, onChange }: Props) {
  function set<K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      {/* Search */}
      <div className="flex-1 min-w-[180px]">
        <input
          type="search"
          placeholder="Search code or name…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Type */}
      <select
        value={filters.itemType}
        onChange={(e) => set('itemType', e.target.value)}
        className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All types</option>
        <option value={ItemType.STOCKED_GOOD}>Stocked Good</option>
        <option value={ItemType.SERVICE}>Service</option>
      </select>

      {/* Category */}
      <select
        value={filters.categoryId}
        onChange={(e) => set('categoryId', e.target.value)}
        className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Flags */}
      <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
        <input
          type="checkbox"
          checked={filters.includeInactive}
          onChange={(e) => set('includeInactive', e.target.checked)}
          className="rounded accent-blue-600"
        />
        Show inactive
      </label>
      <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
        <input
          type="checkbox"
          checked={filters.controlledSubstance}
          onChange={(e) => set('controlledSubstance', e.target.checked)}
          className="rounded accent-blue-600"
        />
        Controlled only
      </label>
    </div>
  );
}
