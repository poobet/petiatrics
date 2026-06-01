'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@petiatrics/ui';
import ItemSearchCombobox from '@/components/inventory/item-search-combobox';
import { useSessionStore } from '@/lib/session-store';

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
}

export default function AdjustmentsClient() {
  const t = useTranslations('inventory.stock.adjustment');

  const activeBranchId = useSessionStore((state) => state.activeBranch?.id);

  // Pending list
  const [adjustments, setAdjustments] = useState<PendingAdjustment[]>([]);
  const [loading, setLoading] = useState(false);

  // Submit form
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [physicalCount, setPhysicalCount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!activeBranchId) {
      setFormError('Please select an active branch before submitting.');
      setSubmitting(false);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/inventory/stock-adjustments', {
        productId: selectedItem.id,
        physicalCount: Number(physicalCount),
        notes: notes || undefined,
      });
      setSelectedItem(null);
      setPhysicalCount('');
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
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('notes')}</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" disabled={submitting || !selectedItem || !physicalCount}>
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
                  <Button size="sm" variant="default" onClick={() => handleApprove(adj.id)}>{t('approve')}</Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectId(adj.id)}>{t('reject')}</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Before: {Number(adj.quantityBefore)} → After: {Number(adj.quantityAfter)} (Δ {Number(adj.delta) >= 0 ? '+' : ''}{Number(adj.delta)})
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
              <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>{t('reject')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

