'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui';
import ItemSearchCombobox from '@/components/inventory/item-search-combobox';
import { useSessionStore } from '@/lib/session-store';
import { format } from 'date-fns';

interface PendingAdjustment {
  id: string;
  productId: string;
  product: { name: string; sku: string | null };
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  overrideReason: string | null;
  createdAt: string;
}

interface SelectedItem {
  id: string;
  name: string;
  requiresBatchAndExpiryTracking?: boolean;
}

interface LotInfo {
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
  isFefo: boolean;
  isExpired: boolean;
}

const REASON_CODES = {
  COUNT_DISCREPANCY: 'Stock Count Error',
  DAMAGED: 'Damaged/Broken',
  EXPIRED: 'Expired/Degraded',
};

export default function AdjustmentsClient() {
  const t = useTranslations('inventory.stock.adjustment');

  const activeBranchId = useSessionStore((state) => state.activeBranch?.id);

  // Pending list
  const [adjustments, setAdjustments] = useState<PendingAdjustment[]>([]);
  const [loading, setLoading] = useState(false);

  // Submit form
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [physicalCount, setPhysicalCount] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [availableLots, setAvailableLots] = useState<LotInfo[]>([]);

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isLotTracked = selectedItem?.requiresBatchAndExpiryTracking ?? false;

  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<PendingAdjustment[]>('/inventory/stock-adjustments');
      setAdjustments(data ?? []);
    } catch {
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdjustments(); }, [loadAdjustments]);

  // Load available lots when item is selected and is lot-tracked
  useEffect(() => {
    if (!selectedItem || !isLotTracked || !activeBranchId) {
      setAvailableLots([]);
      return;
    }

    apiClient
      .get<LotInfo[]>(`/inventory/stock-balances/lots/${selectedItem.id}`)
      .then((data) => setAvailableLots(data ?? []))
      .catch(() => setAvailableLots([]));
  }, [selectedItem, isLotTracked, activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!activeBranchId) {
      setFormError('Please select an active branch before submitting.');
      setSubmitting(false);
      return;
    }
    if (isLotTracked && !lotNumber.trim()) {
      setFormError('Lot number is required for batch-tracked items.');
      setSubmitting(false);
      return;
    }
    if (!reasonCode) {
      setFormError('Reason code is required.');
      setSubmitting(false);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/inventory/stock-adjustments', {
        productId: selectedItem.id,
        physicalCount: Number(physicalCount),
        lotNumber: lotNumber || undefined,
        reasonCode,
        notes: notes || undefined,
      });
      setSelectedItem(null);
      setPhysicalCount('');
      setLotNumber('');
      setReasonCode('');
      setNotes('');
      loadAdjustments();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiClient.patch(`/inventory/stock-adjustments/${id}/approve`, {});
      loadAdjustments();
    } catch { /* noop */ }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      await apiClient.patch(`/inventory/stock-adjustments/${rejectId}/reject`, {
        rejectionReason: rejectReason,
      });
      setRejectId(null);
      setRejectReason('');
      loadAdjustments();
    } catch { /* noop */ }
  };

  const handleQuickFill = () => {
    const systemCount = Number(physicalCount) || 0;
    if (systemCount > 0 && isLotTracked) {
      setLotNumber('UNKNOWN-RECOVERED');
    }
  };

  return (
    <div className="space-y-8">
      {/* Submit form */}
      <div className="rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">{t('newAdjustment')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('selectItem')}</label>
            <ItemSearchCombobox onSelect={(item) => setSelectedItem(item as SelectedItem)} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('physicalCount')}</label>
            <input
              type="number"
              min="0"
              step="any"
              required
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {isLotTracked && (
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">
                    Lot Number <span className="text-destructive">*</span>
                  </label>
                  {availableLots.length > 0 ? (
                    <select
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Select a lot —</option>
                      {availableLots.map((lot, idx) => (
                        <option key={idx} value={lot.lotNumber ?? ''}>
                          {lot.lotNumber ?? '(no lot)'}
                          {lot.expiryDate ? ` – exp ${format(new Date(lot.expiryDate), 'dd MMM yyyy')}` : ''}
                          {` – qty ${lot.quantity}`}
                          {lot.isFefo ? ' ★ FEFO' : ''}
                          {lot.isExpired ? ' [Expired]' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Enter lot number"
                    />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuickFill}
                  disabled={!physicalCount}
                >
                  Quick Fill
                </Button>
              </div>
              {availableLots.length === 0 && (
                <p className="text-xs text-muted-foreground">No existing lots found. Enter a manual lot number.</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Reason Code <span className="text-destructive">*</span>
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select a reason —</option>
              {Object.entries(REASON_CODES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Additional Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="E.g., container was damaged, items expired last month..."
            />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" disabled={submitting || !selectedItem || !physicalCount || !reasonCode}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </form>
      </div>

      {/* Pending list */}
      <div className="space-y-3">
        <h2 className="font-medium">{t('pending')}</h2>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : adjustments.length === 0 ? (
          <div className="text-muted-foreground text-sm">No pending adjustments.</div>
        ) : (
          adjustments.map((adj) => (
            <div key={adj.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{adj.product.name}</span>
                  {adj.product.sku && <span className="ml-2 text-xs text-muted-foreground">{adj.product.sku}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => handleApprove(adj.id)}>
                    {t('approve')}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectId(adj.id)}>
                    {t('reject')}
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Before: {Number(adj.quantityBefore)} → After: {Number(adj.quantityAfter)} (Δ{' '}
                {Number(adj.delta) >= 0 ? '+' : ''}
                {Number(adj.delta)})
              </div>
              {adj.overrideReason && <div className="text-sm italic">{adj.overrideReason}</div>}
            </div>
          ))
        )}
      </div>

      {/* Reject dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">{t('reject')}</h2>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('rejectionReason')}</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                {t('reject')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

