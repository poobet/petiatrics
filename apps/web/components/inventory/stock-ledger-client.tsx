'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useSessionStore } from '@/lib/session-store';
import StockLedgerTable from '@/components/inventory/stock-ledger-table';
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
  const activeBranch = useSessionStore((s) => s.activeBranch);

  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!activeBranch?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (lowStockOnly) params.set('lowStock', 'true');
      const result = await apiClient.get<BalancesResponse>(`/inventory/stock-balances?${params}`);
      setBalances(result?.data ?? []);
    } catch {
      setBalances([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id, lowStockOnly]);

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

      <StockLedgerTable rows={balances} loading={loading} />
    </div>
  );
}

