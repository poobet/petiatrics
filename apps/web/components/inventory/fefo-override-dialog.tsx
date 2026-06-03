'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@petiatrics/ui';

interface Props {
  open: boolean;
  isExpired: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export default function FefoOverrideDialog({ open, isExpired, onConfirm, onCancel }: Props) {
  const t = useTranslations('inventory.stock.fefo');
  const [reason, setReason] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('dialogTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {isExpired ? t('expiredDialogDescription') : t('dialogDescription')}
        </p>
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('reasonLabel')}</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={handleConfirm} disabled={!reason.trim()}>{t('confirm')}</Button>
        </div>
      </div>
    </div>
  );
}

