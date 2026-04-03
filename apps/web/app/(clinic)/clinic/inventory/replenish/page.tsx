'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
}

export default function ReplenishPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/v1/inventory/products')
      .then((r) => r.json())
      .then((json) => setProducts(json.data ?? []))
      .catch(() => {});
  }, []);

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
      const res = await fetch('/api/v1/inventory/stock/replenish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity, referenceId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Failed to replenish stock');
      }
      setSuccess('Stock replenished successfully.');
      form.reset();
      // Refresh product list to show updated quantities
      const updated = await fetch('/api/v1/inventory/products').then((r) => r.json());
      setProducts(updated.data ?? []);
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
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — current: {p.quantity} {p.unit}
              </option>
            ))}
          </select>
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
