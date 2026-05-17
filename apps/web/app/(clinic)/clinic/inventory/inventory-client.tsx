'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ItemSummaryResponse, ItemCategoryResponse } from '@petiatrics/types';
import { ItemType } from '@petiatrics/types';
import ItemTable from '@/components/inventory/item-table';
import ItemFilterBar from '@/components/inventory/item-filter-bar';
import type { ItemFilters } from '@/components/inventory/item-filter-bar';
import { apiClient } from '@/lib/api-client';

interface Props {
  initialItems: ItemSummaryResponse[];
  lowStockItems: ItemSummaryResponse[];
  categories: ItemCategoryResponse[];
}

const DEFAULT_FILTERS: ItemFilters = {
  search: '',
  itemType: '',
  categoryId: '',
  includeInactive: false,
  controlledSubstance: false,
};

export default function InventoryClient({ initialItems, lowStockItems, categories }: Props) {
  const t = useTranslations('inventory');
  const [items, setItems] = useState<ItemSummaryResponse[]>(initialItems);
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<'items' | 'movements'>('items');
  const [movements, setMovements] = useState<unknown[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const lowStockIds = useMemo(() => new Set(lowStockItems.map((p) => p.id)), [lowStockItems]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!filters.includeInactive && !item.isActive) return false;
      if (filters.itemType && item.itemType !== filters.itemType) return false;
      if (filters.categoryId && item.category?.id !== filters.categoryId) return false;
      if (filters.controlledSubstance && !item.isControlledSubstance) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, filters]);

  async function handleDeactivate(id: string) {
    if (!confirm('Deactivate this item? It will no longer be selectable on invoices.')) return;
    try {
      await apiClient.patch(`/inventory/products/${id}/deactivate`, {});
      setItems((prev) => prev.map((p) => p.id === id ? { ...p, isActive: false } : p));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate item.');
    }
  }

  async function loadMovements() {
    if (movements.length > 0) return;
    setLoadingMovements(true);
    try {
      const data = await apiClient.get<unknown[]>('/inventory/stock/movements');
      setMovements(data ?? []);
    } finally {
      setLoadingMovements(false);
    }
  }

  function handleTabChange(tab: 'items' | 'movements') {
    setActiveTab(tab);
    if (tab === 'movements') loadMovements();
  }

  const lowStockCount = lowStockItems.filter((p) => p.itemType === ItemType.STOCKED_GOOD).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          {lowStockCount > 0 && (
            <p className="text-sm text-red-600 mt-1">
              ⚠ {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} below reorder threshold
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/clinic/inventory/replenish"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Replenish Stock
          </Link>
          <Link
            href="/clinic/inventory/products/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            + Add Item
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-4 flex gap-6">
        {(['items', 'movements'] as const).map((tab) => (
          <button
            key={tab}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange(tab)}
          >
            {tab === 'items' ? 'Items' : 'Stock Movements'}
          </button>
        ))}
      </div>

      {activeTab === 'items' && (
        <>
          <ItemFilterBar filters={filters} categories={categories} onChange={setFilters} />
          <ItemTable
            items={filteredItems}
            lowStockIds={lowStockIds}
            onDeactivate={handleDeactivate}
          />
          <p className="text-xs text-gray-400 mt-2">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} shown</p>
        </>
      )}

      {activeTab === 'movements' && (
        <div>
          {loadingMovements && <p className="text-sm text-gray-500">Loading…</p>}
          {!loadingMovements && movements.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">No stock movements found.</p>
          )}
        </div>
      )}
    </div>
  );
}

