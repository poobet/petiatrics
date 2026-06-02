'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
      const params = new URLSearchParams({ page: '1', limit: '100' });
      const result = await apiClient.get<BalancesResponse>(`/inventory/products/${itemId}/all-branch-balances?${params}`);
      setBalances(result?.data ?? []);
    } catch (err) {
      setBalances([]);
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [itemId, t]);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  const sortedBalances = useMemo(() => {
    return [...balances].sort((a, b) => {
      const branchCompare = (a.branchName ?? '').localeCompare(b.branchName ?? '');
      if (branchCompare !== 0) return branchCompare;
      return (a.lotNumber ?? '').localeCompare(b.lotNumber ?? '');
    });
  }, [balances]);

  if (!itemId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
        {t('saveItemToViewStock')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('stockAcrossBranchesDescription')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchBalances()} disabled={loading}>
          {loading ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <StockLedgerTable
        rows={sortedBalances}
        loading={loading}
        showBranchColumn
        hideItemColumn
        showStatusColumn={false}
        emptyMessage={t('noStockRecorded')}
      />
    </div>
  );
}
