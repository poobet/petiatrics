'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import type { ItemSummaryResponse } from '@petiatrics/types';

type ReplenishProduct = ItemSummaryResponse & { quantity: number | null };

export default function ReplenishPage() {
  const router = useRouter();
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const [products, setProducts] = useState<ReplenishProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  useEffect(() => {
    if (!activeBranch) return;
    apiClient
      .get<{ items: ReplenishProduct[] }>('/inventory/products')
      .then((result) => {
        const stocked = (result?.items ?? []).filter((p) => p.itemType !== 'SERVICE');
        setProducts(stocked);
      })
      .catch(() => {});
  }, [activeBranch]);

  if (!activeBranch) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="mb-6">
          <button type="button" onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2">
            ← Back to Inventory
          </button>
          <h1 className="text-2xl font-bold">Replenish Stock</h1>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Select a branch from the top navigation to replenish stock.
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    const form = e.currentTarget;
    const productId = (form.elements.namedItem('productId') as HTMLSelectElement).value;
    const quantity = Number((form.elements.namedItem('quantity') as HTMLInputElement).value);
    const referenceId = (form.elements.namedItem('referenceId') as HTMLInputElement).value.trim();

    try {
      await apiClient.post('/inventory/stock/replenish', { productId, quantity, referenceId });
      setSuccess('Stock replenished successfully.');
      form.reset();
      setSelectedProductId('');
      // Refresh product list to show updated quantities
      const updated = await apiClient.get<{ items: ReplenishProduct[] }>('/inventory/products');
      setProducts((updated?.items ?? []).filter((p) => p.itemType !== 'SERVICE'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          ← Back to Inventory
        </button>
        <h1 className="text-2xl font-bold">Replenish Stock</h1>
        <p className="text-xs text-gray-500 mt-0.5">Branch: {activeBranch.name}</p>
        <p className="text-sm text-gray-500 mt-1">Record incoming stock for a product</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border p-6">
        <div>
          <label htmlFor="productId" className="block text-sm font-medium text-gray-700 mb-1">
            Product *
          </label>
          <select
            id="productId"
            name="productId"
            required
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          {selectedProduct && (
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-gray-500">Category</span>
              <span>{selectedProduct.category?.name ?? '—'}</span>
              <span className="text-gray-500">Unit</span>
              <span>{selectedProduct.baseUnit ? `${selectedProduct.baseUnit.name}${selectedProduct.baseUnit.symbol ? ` (${selectedProduct.baseUnit.symbol})` : ''}` : '—'}</span>
              {selectedProduct.quantity !== null && (
                <>
                  <span className="text-gray-500">Current Stock</span>
                  <span className={selectedProduct.quantity === 0 ? 'text-red-600 font-medium' : ''}>
                    {selectedProduct.quantity} {selectedProduct.baseUnit?.symbol ?? ''}
                  </span>
                </>
              )}
              <span className="text-gray-500">Cost</span>
              <span>฿{selectedProduct.standardCost.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
            Quantity to Add *
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            required
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 50"
          />
        </div>

        <div>
          <label htmlFor="referenceId" className="block text-sm font-medium text-gray-700 mb-1">
            Reference / Order ID *
          </label>
          <p className="text-xs text-gray-500 mb-1">Supplier order number or internal reference for audit trail</p>
          <input
            id="referenceId"
            name="referenceId"
            required
            className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. PO-2024-001"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Replenish'}
          </button>
        </div>
      </form>
    </div>
  );
}
