'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@petiatrics/ui';
import { apiClient } from '@/lib/api-client';
import StockLedgerTable, { type StockBalance } from '../stock-ledger-table';

interface BalancesResponse {
  data: StockBalance[];
  total: number;
  page: number;
  limit: number;
}

interface Props {
  itemId?: string;
}

export default function ItemStockTab({ itemId }: Props) {
  const t = useTranslations('inventory.stock.ledger');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchBalances = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ page: '1', limit: '100', productId: itemId });
      const result = await apiClient.get<BalancesResponse>(`/inventory/stock-balances?${params}`);
      setBalances(result?.data ?? []);
    } catch (err) {
      setBalances([]);
      setError('Unable to load stock balances at the moment.');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  if (!itemId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        Save item to view stock.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-gray-500">View current stock balances for this product across branches.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchBalances()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <StockLedgerTable
        rows={balances}
        loading={loading}
        showBranchColumn
        emptyMessage="No stock recorded for this item yet."
      />
    </div>
  );
}
