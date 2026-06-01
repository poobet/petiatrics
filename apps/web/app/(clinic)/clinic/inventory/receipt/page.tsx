import { getTranslations } from 'next-intl/server';
import GoodsReceiptForm from '@/components/inventory/goods-receipt-form';

export default async function GoodsReceiptPage() {
  const t = await getTranslations('inventory.stock.receipt');
  return (
    <div className="p-6 max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <GoodsReceiptForm />
    </div>
  );
}
