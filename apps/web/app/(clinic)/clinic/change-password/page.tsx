'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiClient } from '../../../../lib/api-client';
import { useSessionStore } from '../../../../lib/session-store';

export default function ChangePasswordPage() {
  const t = useTranslations('auth.changePassword');
  const router = useRouter();
  const mustChange = useSessionStore((s) => s.user?.mustChangePassword ?? false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword: mustChange ? undefined : currentPassword,
        newPassword,
      });
      router.push('/clinic/dashboard');
    } catch (err: any) {
      setError(err?.message ?? t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('title')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('subtitle')}</p>

        {mustChange && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {t('mustChangeNotice')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!mustChange && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('currentPassword')}
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('newPassword')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('confirmPassword')}
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('saving') : t('submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
