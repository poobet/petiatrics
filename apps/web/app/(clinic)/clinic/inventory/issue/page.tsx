import { getTranslations } from 'next-intl/server';
import GoodsIssueForm from '@/components/inventory/goods-issue-form';

export default async function GoodsIssuePage() {
  const t = await getTranslations('inventory.stock.issue');
  return (
    <div className="p-6 max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <GoodsIssueForm />
    </div>
  );
}
