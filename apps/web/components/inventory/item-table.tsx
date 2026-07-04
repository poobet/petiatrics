'use client';

import type { ItemSummaryResponse } from '@petiatrics/types';
import { ItemType } from '@petiatrics/types';
import Link from 'next/link';
import ItemStatusBadge from './item-status-badge';

interface Props {
  items: ItemSummaryResponse[];
  lowStockIds: Set<string>;
  onDeactivate: (id: string) => void;
}

export default function ItemTable({ items, lowStockIds, onDeactivate }: Props) {
  if (items.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-400 text-sm">
        No items found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Base Unit</th>
            <th className="px-4 py-3 text-right">Sell Price</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const isLow = item.itemType === ItemType.INVENTORY && lowStockIds.has(item.id);
            return (
              <tr
                key={item.id}
                className={isLow ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.code}</td>
                <td className="px-4 py-3 font-medium">
                  {isLow && <span className="mr-1 text-red-500" title="Low stock">⚠</span>}
                  {item.name}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    item.itemType === ItemType.SERVICE
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.itemType === ItemType.SERVICE ? 'Service' : 'Stocked'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{item.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{item.baseUnit?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.baseSellingPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.itemType === ItemType.INVENTORY ? (item as { quantity?: number }).quantity ?? 0 : '—'}
                </td>
                <td className="px-4 py-3">
                  <ItemStatusBadge isActive={item.isActive} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/clinic/inventory/products/${item.id}/edit`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </Link>
                    {item.isActive && (
                      <button
                        type="button"
                        onClick={() => onDeactivate(item.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
