'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import StockLedgerTable, { type MovementHistoryRow, type ProductSummaryRow } from '@/components/inventory/stock-ledger-table';
import LowStockBanner from '@/components/inventory/low-stock-banner';
import { Button } from '@petiatrics/ui';

interface StockBalance {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sku: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  reorderPoint: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED';
}

interface BalancesResponse {
  data: StockBalance[];
  total: number;
  page: number;
  limit: number;
}

export default function StockLedgerClient() {
  const t = useTranslations('inventory.stock.ledger');
  const activeBranchId = useSessionStore((s) => s.activeBranch?.id);

  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [movementHistory, setMovementHistory] = useState<Record<string, MovementHistoryRow[]>>({});
  const [movementLoadingFor, setMovementLoadingFor] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!activeBranchId) {
      setBalances([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '100', branchId: activeBranchId });
      if (lowStockOnly) params.set('lowStock', 'true');
      const result = await apiClient.get<BalancesResponse>(`/inventory/stock-balances?${params}`);
      setBalances(result?.data ?? []);
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, lowStockOnly]);

  const groupedProducts = useMemo<ProductSummaryRow[]>(() => {
    const map = new Map<string, ProductSummaryRow>();
    for (const balance of balances) {
      const existing = map.get(balance.productId);
      if (existing) {
        existing.totalQuantity += balance.quantity;
      } else {
        map.set(balance.productId, {
          productId: balance.productId,
          productName: balance.productName,
          sku: balance.sku,
          totalQuantity: balance.quantity,
          reorderPoint: balance.reorderPoint,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [balances]);

  const fetchMovements = useCallback(
    async (productId: string) => {
      if (!activeBranchId) return;
      if (movementHistory[productId]) {
        setExpandedProductId(productId);
        return;
      }

      setExpandedProductId(productId);
      setMovementLoadingFor(productId);
      try {
        const params = new URLSearchParams({ productId, branchId: activeBranchId, page: '1', limit: '100' });
        const result = await apiClient.get<MovementHistoryRow[]>(`/inventory/stock/movements?${params}`);
        const rows = Array.isArray(result)
          ? result
          : (result as { data?: MovementHistoryRow[] })?.data ?? [];
        setMovementHistory((prev) => ({ ...prev, [productId]: rows }));
      } catch {
        setMovementHistory((prev) => ({ ...prev, [productId]: [] }));
      } finally {
        setMovementLoadingFor(null);
      }
    },
    [activeBranchId, movementHistory],
  );

  const toggleDetails = (productId: string) => {
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      return;
    }
    void fetchMovements(productId);
  };

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return (
    <div className="space-y-4">
      <LowStockBanner />

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <Link href="/clinic/inventory/receipt">
          <Button variant="default" size="sm">{t('newReceipt')}</Button>
        </Link>
        <Link href="/clinic/inventory/issue">
          <Button variant="outline" size="sm">{t('newIssue')}</Button>
        </Link>
        <Link href="/clinic/inventory/adjustments">
          <Button variant="outline" size="sm">{t('adjustStock')}</Button>
        </Link>
        <label className="flex items-center gap-2 ml-auto text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded"
          />
          {t('status.lowStock')}
        </label>
      </div>

      <StockLedgerTable
        summaryRows={groupedProducts}
        detailRows={movementHistory}
        expandedProductIds={expandedProductId ? [expandedProductId] : []}
        onToggleDetails={toggleDetails}
        detailLoadingProductId={movementLoadingFor}
        loading={loading}
      />
    </div>
  );
}

