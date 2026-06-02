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
            {summaryRows.map((summary) => {
              const expanded = expandedProductIds.includes(summary.productId);
              const movementRows = detailRows[summary.productId] ?? [];
              const loadingDetails = detailLoadingProductId === summary.productId;

              return (
                <Fragment key={summary.productId}>
                  <tr className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{summary.productName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{summary.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{summary.totalQuantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => onToggleDetails?.(summary.productId)}>
                        {expanded ? t('actions.hideDetails') : t('actions.viewDetails')}
                      </Button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={4} className="px-4 py-4">
                        {loadingDetails ? (
                          <div className="text-center text-sm text-muted-foreground">{t('loading')}</div>
                        ) : movementRows.length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">{t('columns.date')}</th>
                                  <th className="px-3 py-2 text-left font-medium">{t('columns.action')}</th>
                                  <th className="px-3 py-2 text-left font-medium">{t('columns.lotNumber')}</th>
                                  <th className="px-3 py-2 text-right font-medium">{t('columns.quantityChanged')}</th>
                                  <th className="px-3 py-2 text-left font-medium">{t('columns.user')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {movementRows.map((movement) => {
                                  const typeLabel =
                                    movement.movementType === 'GOODS_RECEIPT' || movement.reason === 'REPLENISH' || movement.referenceType === 'REPLENISHMENT'
                                      ? t('actions.receipt')
                                      : movement.movementType === 'GOODS_ISSUE' || movement.reason === 'DISPENSE' || movement.referenceType === 'VISIT_RECORD'
                                      ? t('actions.issue')
                                      : movement.reason === 'MANUAL_ADJUSTMENT'
                                      ? t('actions.adjust')
                                      : movement.reason ?? movement.status ?? t('unknownAction');
                                  const quantity = movement.quantityChange ?? movement.delta ?? movement.quantity ?? 0;
                                  const user = movement.actor?.name ?? '—';

                                  return (
                                    <tr key={movement.id} className="border-t hover:bg-muted/10 transition-colors">
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {movement.createdAt ? format(new Date(movement.createdAt), 'dd MMM yyyy HH:mm') : '—'}
                                      </td>
                                      <td className="px-3 py-2">{typeLabel}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{movement.lotNumber ?? '—'}</td>
                                      <td className="px-3 py-2 text-right font-mono">{quantity >= 0 ? `+${quantity}` : quantity}</td>
                                      <td className="px-3 py-2">{user}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">{t('noMovementHistory')}</div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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
