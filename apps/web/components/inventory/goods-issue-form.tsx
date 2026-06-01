'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui';
import ItemSearchCombobox from '@/components/inventory/item-search-combobox';
import FefoOverrideDialog from '@/components/inventory/fefo-override-dialog';
import { format } from 'date-fns';
import { useSessionStore } from '@/lib/session-store';

interface SelectedItem {
  id: string;
  name: string;
  requiresBatchAndExpiryTracking: boolean;
}

interface LotInfo {
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  isFefo: boolean;
  isExpired: boolean;
}

export default function GoodsIssueForm() {
  const t = useTranslations('inventory.stock.issue');
  const router = useRouter();
  const activeBranchId = useSessionStore((state) => state.activeBranch?.id);

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [selectedLot, setSelectedLot] = useState<LotInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ reason: string } | null>(null);

  // Load lots when item is selected
  useEffect(() => {
    if (!selectedItem) { setLots([]); setSelectedLot(null); return; }
    apiClient.get<LotInfo[]>(`/inventory/stock-balances/lots/${selectedItem.id}`)
      .then((data) => {
        setLots(data ?? []);
        setSelectedLot(data?.[0] ?? null);
      })
      .catch(() => setLots([]));
  }, [selectedItem]);

  const doSubmit = async (overrideReason?: string) => {
    if (!selectedItem) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/inventory/stock-movements', {
        movementType: 'GOODS_ISSUE',
        branchId: activeBranchId as string,
        productId: selectedItem.id,
        quantity: Number(quantity),
        ...(selectedLot?.lotNumber ? { lotNumber: selectedLot.lotNumber } : {}),
        ...(overrideReason ? { overrideReason } : {}),
      });
      router.push('/clinic/inventory/stock-ledger');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(t('insufficientStock'));
      } else {
        setError(err instanceof ApiError ? err.message : t('error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !quantity) return;

    const needsOverride = selectedLot && (!selectedLot.isFefo || selectedLot.isExpired);
    if (needsOverride && !pendingOverride) {
      setShowOverrideDialog(true);
      return;
    }
    await doSubmit(pendingOverride?.reason);
  };

  const handleOverrideConfirm = async (reason: string) => {
    setPendingOverride({ reason });
    setShowOverrideDialog(false);
    await doSubmit(reason);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('selectItem')}</label>
          <ItemSearchCombobox onSelect={(item) => setSelectedItem(item as SelectedItem)} />
        </div>

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

        {lots.length > 0 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('selectLot')}</label>
            <select
              value={selectedLot?.lotNumber ?? ''}
              onChange={(e) => {
                const lot = lots.find((l) => l.lotNumber === e.target.value) ?? null;
                setSelectedLot(lot);
                setPendingOverride(null);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {lots.map((lot, i) => (
                <option key={i} value={lot.lotNumber ?? ''}>
                  {lot.lotNumber ?? '(no lot)'}
                  {lot.expiryDate ? ` — exp ${format(new Date(lot.expiryDate), 'dd MMM yyyy')}` : ''}
                  {` — qty ${lot.quantity}`}
                  {lot.isFefo ? ` ★ ${t('fefoRecommended')}` : ''}
                  {lot.isExpired ? ` [${t('expired')}]` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting || !selectedItem || !quantity} className="w-full">
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </form>

      <FefoOverrideDialog
        open={showOverrideDialog}
        isExpired={selectedLot?.isExpired ?? false}
        onConfirm={handleOverrideConfirm}
        onCancel={() => setShowOverrideDialog(false)}
      />
    </>
  );
}

