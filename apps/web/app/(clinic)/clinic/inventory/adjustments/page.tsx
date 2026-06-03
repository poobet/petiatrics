import { getTranslations } from 'next-intl/server';
import AdjustmentsClient from '@/components/inventory/adjustments-client';

export default async function AdjustmentsPage() {
  const t = await getTranslations('inventory.stock.adjustment');
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <AdjustmentsClient />
    </div>
  );
}
