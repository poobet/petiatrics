'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient, ApiError } from '@/lib/api-client';

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; code: string; message: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ open, onClose, onSuccess }: Props) {
  const t = useTranslations('inventory.items.bulkImport');
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.postForm<ImportResult>('/inventory/bulk-import/items', form);
      setResult(res);
      if (res.created > 0) onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-gray-500">{t('description')}</p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
          onChange={handleFileChange}
        />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-md border bg-gray-50 px-3 py-3 text-sm space-y-1">
            <p className="font-medium">{t('resultTitle')}</p>
            <p className="text-green-700">{t('created', { count: result.created })}</p>
            <p className="text-gray-500">{t('skipped', { count: result.skipped })}</p>
            {result.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-medium text-red-600">{t('errors', { count: result.errors.length })}</p>
                <ul className="max-h-40 overflow-y-auto space-y-0.5">
                  {result.errors.map((e) => (
                    <li key={e.row} className="text-xs text-red-600">
                      {t('errorRow', { row: e.row, code: e.code, message: e.message })}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => { void handleImport(); }}
            disabled={!file || loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('importing') : t('import')}
          </button>
        </div>
      </div>
    </div>
  );
}
