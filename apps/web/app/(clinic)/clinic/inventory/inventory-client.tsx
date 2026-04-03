'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  reorderThreshold: number;
  isActive: boolean;
}

interface Movement {
  id: string;
  productId: string;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  createdAt: string;
}

interface Props {
  initialProducts: Product[];
  lowStockProducts: Product[];
}

export default function InventoryClient({ initialProducts, lowStockProducts }: Props) {
  const [activeTab, setActiveTab] = useState<'products' | 'movements'>('products');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  const lowStockIds = new Set(lowStockProducts.map((p: Product) => p.id));
  const displayProducts = filterLowStock
    ? initialProducts.filter((p) => lowStockIds.has(p.id))
    : initialProducts;

  async function loadMovements() {
    if (movements.length > 0) return;
    setLoadingMovements(true);
    try {
      const res = await fetch('/api/v1/inventory/stock/movements');
      if (res.ok) {
        const json = await res.json();
        setMovements(json.data ?? []);
      }
    } finally {
      setLoadingMovements(false);
    }
  }

  function handleTabChange(tab: 'products' | 'movements') {
    setActiveTab(tab);
    if (tab === 'movements') loadMovements();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          {lowStockProducts.length > 0 && (
            <p className="text-sm text-red-600 mt-1">
              ⚠ {lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''} below reorder threshold
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
            + Add Product
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-4 flex gap-6">
        <button
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => handleTabChange('products')}
        >
          Products
        </button>
        <button
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => handleTabChange('movements')}
        >
          Stock Movements
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filterLowStock}
                onChange={(e) => setFilterLowStock(e.target.checked)}
                className="rounded"
              />
              Show low-stock only
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Reorder At</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      No products found.
                    </td>
                  </tr>
                )}
                {displayProducts.map((product) => {
                  const isLow = lowStockIds.has(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={isLow ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-3 font-medium">
                        {isLow && <span className="mr-1 text-red-500">⚠</span>}
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{product.sku}</td>
                      <td className="px-4 py-3 text-gray-500">{product.category}</td>
                      <td className="px-4 py-3 text-right font-mono">{product.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{product.reorderThreshold}</td>
                      <td className="px-4 py-3 text-gray-500">{product.unit}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'movements' && (
        <div className="overflow-x-auto rounded-lg border">
          {loadingMovements ? (
            <div className="p-8 text-center text-gray-400">Loading movements…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">Delta</th>
                  <th className="px-4 py-3 text-right">Before</th>
                  <th className="px-4 py-3 text-right">After</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No movements recorded yet.
                    </td>
                  </tr>
                )}
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{m.productId}</td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-medium ${Number(m.delta) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {Number(m.delta) >= 0 ? '+' : ''}
                      {m.delta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{m.quantityBefore}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{m.quantityAfter}</td>
                    <td className="px-4 py-3 text-gray-500">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
