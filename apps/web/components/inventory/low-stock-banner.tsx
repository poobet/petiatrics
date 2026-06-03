'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api-client';

interface StockAlert {
  id: string;
  productId: string;
  product: {
    name: string;
    sku: string | null;
    reorderPoint: number;
    defaultSupplier: { name: string } | null;
  };
}

const POLL_INTERVAL_MS = 30_000;

export default function LowStockBanner() {
  const t = useTranslations('inventory.stock.alerts');
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const fetchAlerts = () => {
    apiClient
      .get<StockAlert[]>('/inventory/alerts/low-stock')
      .then((data) => {
        setAlerts(data ?? []);
        if ((data?.length ?? 0) === 0) setDismissed(false);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0 || dismissed) return null;

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-800">
          ⚠ {t('banner', { count: alerts.length })}
        </span>
        <button
          className="text-xs text-amber-600 underline"
          onClick={() => setDismissed(true)}
        >
          {t('dismiss')}
        </button>
      </div>
      <ul className="space-y-1">
        {alerts.slice(0, 5).map((alert) => (
          <li key={alert.id} className="text-xs text-amber-700">
            <span className="font-medium">{alert.product.name}</span>
            {alert.product.sku ? ` (${alert.product.sku})` : ''}
            {' · '}
            {t('reorderPoint', { rp: Number(alert.product.reorderPoint) })}
            {' · '}
            {alert.product.defaultSupplier
              ? t('supplier', { supplier: alert.product.defaultSupplier.name })
              : t('noSupplier')}
          </li>
        ))}
        {alerts.length > 5 && (
          <li className="text-xs text-amber-600 italic">…and {alerts.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}
