'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ItemSummaryResponse, ItemCategoryResponse } from '@petiatrics/types';
import { ItemType } from '@petiatrics/types';
import ItemTable from '@/components/inventory/item-table';
import ItemFilterBar from '@/components/inventory/item-filter-bar';
import type { ItemFilters } from '@/components/inventory/item-filter-bar';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import { BulkImportModal } from '@/components/inventory/bulk-import-modal';
import { usePermission } from '@/lib/use-permission';

interface Props {
  categories: ItemCategoryResponse[];
}

const DEFAULT_FILTERS: ItemFilters = {
  search: '',
  itemType: '',
  categoryId: '',
  includeInactive: false,
  controlledSubstance: false,
};

export default function InventoryClient({ categories }: Props) {
  const t = useTranslations('inventory');
  const activeBranch = useSessionStore((s) => s.activeBranch);

  const [items, setItems] = useState<ItemSummaryResponse[]>([]);
  const [lowStockItems, setLowStockItems] = useState<ItemSummaryResponse[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState<'items' | 'movements' | 'locations' | 'reason-codes'>('items');
  const [movements, setMovements] = useState<unknown[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const canAddInventory = usePermission('INVENTORY:ADD');
  const canEditInventory = usePermission('INVENTORY:EDIT');

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

  const loadBranchInventory = useCallback(async () => {
    if (!activeBranch) return;
    setLoadingItems(true);
    try {
      const [productsResult, lowStockResult] = await Promise.allSettled([
        apiClient.get<{ items: ItemSummaryResponse[] }>('/inventory/products'),
        apiClient.get<ItemSummaryResponse[]>('/inventory/products/low-stock'),
      ]);
      setItems(productsResult.status === 'fulfilled' ? (productsResult.value?.items ?? []) : []);
      setLowStockItems(lowStockResult.status === 'fulfilled' ? (lowStockResult.value ?? []) : []);
    } finally {
      setLoadingItems(false);
    }
  }, [activeBranch]);

  useEffect(() => {
    setItems([]);
    setLowStockItems([]);
    setMovements([]);
    void loadBranchInventory();
  }, [loadBranchInventory]);

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
    if (movements.length > 0 || !activeBranch) return;
    setLoadingMovements(true);
    try {
      const data = await apiClient.get<unknown[]>('/inventory/stock/movements');
      setMovements(data ?? []);
    } finally {
      setLoadingMovements(false);
    }
  }

  function handleTabChange(tab: 'items' | 'movements' | 'locations' | 'reason-codes') {
    setActiveTab(tab);
    if (tab === 'movements') void loadMovements();
  }

  const lowStockCount = lowStockItems.filter((p) => p.itemType === ItemType.INVENTORY).length;

  if (!activeBranch) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Select a branch from the top navigation to view inventory.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Branch: {activeBranch.name}</p>
          {lowStockCount > 0 && (
            <p className="text-sm text-red-600 mt-1">
              ⚠ {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} below reorder threshold
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/clinic/inventory/settings"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center gap-1.5 font-medium text-gray-700"
          >
            ⚙️ Inventory Settings
          </Link>
          {canAddInventory && (
            <Link
              href="/clinic/inventory/replenish"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Replenish Stock
            </Link>
          )}
          {canEditInventory && (
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Import CSV / XLSX
            </button>
          )}
          {canAddInventory && (
            <Link
              href="/clinic/inventory/products/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              + Add Item
            </Link>
          )}
        </div>
      </div>

      <BulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => { void loadBranchInventory(); }}
      />

      {/* Tabs */}
      <div className="border-b mb-4 flex gap-6">
        {[
          { key: 'items', label: 'Items (สินค้า & บริการ)' },
          { key: 'movements', label: 'Stock Movements (ประวัติสินค้า)' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleTabChange(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'items' && (
        <>
          <ItemFilterBar
            filters={filters}
            categories={categories}
            onChange={setFilters}
          />
          <div className="mt-4">
            <ItemTable
              items={filteredItems}
              lowStockIds={lowStockIds}
              onDeactivate={handleDeactivate}
            />
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <div className="mt-4">
          {loadingMovements ? (
            <div className="text-gray-500 text-sm py-4">Loading movements…</div>
          ) : (
            <div className="border rounded-md divide-y text-sm">
              {movements.length === 0 ? (
                <div className="p-4 text-gray-400">No stock movements recorded yet.</div>
              ) : (
                movements.map((m: any) => (
                  <div key={m.id} className="p-3 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-gray-800">{m.product?.name ?? m.productId}</span>
                      <span className="ml-2 text-xs text-gray-400">{m.reason}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono font-bold ${Number(m.delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(m.delta) >= 0 ? `+${m.delta}` : m.delta}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
