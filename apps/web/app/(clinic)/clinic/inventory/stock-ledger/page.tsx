import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import StockLedgerClient from '@/components/inventory/stock-ledger-client';

export default async function StockLedgerPage() {
  const t = await getTranslations('inventory.stock.ledger');

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <StockLedgerClient />
      </Suspense>
    </div>
  );
}
