'use client';

import { useTranslations } from 'next-intl';
import { format } from 'date-fns';

export interface StockBalance {
  id: string;
  productName: string;
  sku: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  reorderPoint: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
  branchName?: string;
}

interface Props {
  rows: StockBalance[];
  loading?: boolean;
  showBranchColumn?: boolean;
  emptyMessage?: string;
}

const STATUS_BADGE: Record<string, string> = {
  IN_STOCK: 'bg-green-100 text-green-800',
  LOW_STOCK: 'bg-amber-100 text-amber-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-700 line-through',
};

export default function StockLedgerTable({ rows, loading, showBranchColumn = false, emptyMessage }: Props) {
  const t = useTranslations('inventory.stock.ledger');
  const message = emptyMessage ?? t('noMovements');

  if (loading) {
    return <div className="text-muted-foreground py-8 text-center">Loading…</div>;
  }

  if (rows.length === 0) {
    return <div className="text-muted-foreground py-8 text-center">{message}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {showBranchColumn && (
              <th className="px-4 py-3 text-left font-medium">{t('columns.branch')}</th>
            )}
            <th className="px-4 py-3 text-left font-medium">{t('columns.item')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('columns.lot')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('columns.expiry')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('columns.quantity')}</th>
            <th className="px-4 py-3 text-center font-medium">{t('columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors">
              {showBranchColumn && (
                <td className="px-4 py-3 text-muted-foreground">{row.branchName ?? '—'}</td>
              )}
              <td className="px-4 py-3">
                <div className="font-medium">{row.productName}</div>
                {row.sku && <div className="text-xs text-muted-foreground">{row.sku}</div>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{row.lotNumber ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.expiryDate ? format(new Date(row.expiryDate), 'dd MMM yyyy') : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {row.quantity.toLocaleString()}
                {row.quantity <= row.reorderPoint && row.quantity > 0 && (
                  <span className="ml-1 text-amber-500" title={`Reorder at ${row.reorderPoint}`}>▲</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? ''}`}>
                  {t(`status.${row.status === 'IN_STOCK' ? 'inStock' : row.status === 'LOW_STOCK' ? 'lowStock' : row.status === 'OUT_OF_STOCK' ? 'outOfStock' : 'expired'}`)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
