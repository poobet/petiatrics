'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui';
import ItemSearchCombobox from '@/components/inventory/item-search-combobox';
import { useSessionStore } from '@/lib/session-store';

interface SelectedItem {
  id: string;
  name: string;
  sku: string | null;
  requiresBatchAndExpiryTracking: boolean;
}

interface GoodsReceiptPayload {
  movementType: 'GOODS_RECEIPT';
  branchId: string;
  productId: string;
  quantity: number;
  lotNumber?: string;
  expiryDate?: string;
  referenceId?: string;
}

export default function GoodsReceiptForm() {
  const t = useTranslations('inventory.stock.receipt');
  const router = useRouter();
  const activeBranchId = useSessionStore((state) => state.activeBranch?.id);

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLotTracking = selectedItem?.requiresBatchAndExpiryTracking ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setError(null);

    // Client-side validation for batch-tracked items
    if (needsLotTracking) {
      if (!lotNumber.trim()) {
        setError(t('lotNumberRequired'));
        return;
      }
      if (!expiryDate) {
        setError(t('expiryDateRequired'));
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: GoodsReceiptPayload = {
        movementType: 'GOODS_RECEIPT',
        branchId: activeBranchId as string,
        productId: selectedItem.id,
        quantity: Number(quantity),
        ...(lotNumber ? { lotNumber } : {}),
        ...(expiryDate ? { expiryDate } : {}),
        ...(referenceId ? { referenceId } : {}),
      };

      await apiClient.post('/inventory/stock-movements', payload);
      router.push('/clinic/inventory/stock-ledger');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Item search */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('selectItem')}</label>
        <ItemSearchCombobox onSelect={(item) => setSelectedItem(item as SelectedItem)} />
      </div>

      {/* Quantity */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('quantity')}</label>
        <input
          type="number"
          min="0.001"
          step="any"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Lot & Expiry — shown always but required only when batch-tracked */}
      <div className="space-y-1">
        <label className="text-sm font-medium">
          {t('lotNumber')} {needsLotTracking && <span className="text-destructive">*</span>}
        </label>
        <input
          type="text"
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. LOT-2025-001"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          {t('expiryDate')} {needsLotTracking && <span className="text-destructive">*</span>}
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Reference */}
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('referenceId')}</label>
        <input
          type="text"
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="PO-2025-001"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting || !selectedItem || !quantity} className="w-full">
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

