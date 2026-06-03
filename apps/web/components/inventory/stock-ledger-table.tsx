'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { Button } from '@petiatrics/ui';

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

export interface ProductSummaryRow {
  productId: string;
  productName: string;
  sku: string | null;
  totalQuantity: number;
  reorderPoint: number;
}

export interface MovementHistoryRow {
  id: string;
  createdAt: string;
  movementType?: string;
  referenceType?: string;
  reason?: string;
  lotNumber?: string | null;
  quantityChange?: number;
  delta?: number;
  quantity?: number;
  actor?: { id: string; name: string } | null;
  status?: string;
}

interface Props {
  rows?: StockBalance[];
  summaryRows?: ProductSummaryRow[];
  detailRows?: Record<string, MovementHistoryRow[]>;
  expandedProductIds?: string[];
  onToggleDetails?: (productId: string) => void;
  detailLoadingProductId?: string | null;
  loading?: boolean;
  showBranchColumn?: boolean;
  showStatusColumn?: boolean;
  hideItemColumn?: boolean;
  emptyMessage?: string;
  onViewDetails?: (product: ProductSummaryRow) => void;
}

const STATUS_BADGE: Record<string, string> = {
  IN_STOCK: 'bg-green-100 text-green-800',
  LOW_STOCK: 'bg-amber-100 text-amber-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-700 line-through',
};

export default function StockLedgerTable({
  rows = [],
  summaryRows,
  detailRows = {},
  expandedProductIds = [],
  onToggleDetails,
  detailLoadingProductId,
  loading,
  showBranchColumn = false,
  showStatusColumn = true,
  hideItemColumn = false,
  emptyMessage,
  onViewDetails,
}: Props) {
  const t = useTranslations('inventory.stock.ledger');
  const message = emptyMessage ?? t('noMovements');
  const summaryMode = Array.isArray(summaryRows);

  if (loading) {
    return <div className="text-muted-foreground py-8 text-center">{t('loading')}</div>;
  }

  if (summaryMode && summaryRows?.length === 0) {
    return <div className="text-muted-foreground py-8 text-center">{message}</div>;
  }

  if (!summaryMode && rows.length === 0) {
    return <div className="text-muted-foreground py-8 text-center">{message}</div>;
  }

  if (summaryMode) {
    return (
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t('columns.productName')}</th>
              <th className="px-4 py-3 text-left font-medium">{t('columns.sku')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('columns.totalQuantity')}</th>
              <th className="px-4 py-3 text-right font-medium">{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {summaryRows.map((summary) => (
              <tr key={summary.productId} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{summary.productName}</td>
                <td className="px-4 py-3 text-muted-foreground">{summary.sku ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">{summary.totalQuantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => onViewDetails?.(summary)}>
                    {t('actions.viewDetails')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {showBranchColumn && (
              <th className="px-4 py-3 text-left font-medium">{t('columns.branch')}</th>
            )}
            {!hideItemColumn && (
              <th className="px-4 py-3 text-left font-medium">{t('columns.productName')}</th>
            )}
            <th className="px-4 py-3 text-left font-medium">{t('columns.lot')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('columns.expiry')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('columns.quantity')}</th>
            {showStatusColumn && (
              <th className="px-4 py-3 text-center font-medium">{t('columns.status')}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-muted/30 transition-colors">
              {showBranchColumn && (
                <td className="px-4 py-3 text-muted-foreground">{row.branchName ?? '—'}</td>
              )}
              {!hideItemColumn && (
                <td className="px-4 py-3">
                  <div className="font-medium">{row.productName}</div>
                  {row.sku && <div className="text-xs text-muted-foreground">{row.sku}</div>}
                </td>
              )}
              <td className="px-4 py-3 text-muted-foreground">{row.lotNumber ?? '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {row.expiryDate ? format(new Date(row.expiryDate), 'dd MMM yyyy') : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono">{row.quantity.toLocaleString()}</td>
              {showStatusColumn && (
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? ''}`}>
                    {t(`status.${row.status === 'IN_STOCK' ? 'inStock' : row.status === 'LOW_STOCK' ? 'lowStock' : row.status === 'OUT_OF_STOCK' ? 'outOfStock' : 'expired'}`)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
