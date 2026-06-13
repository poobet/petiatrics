'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSessionStore } from '../../lib/session-store';

export function CustomerLogoutButton() {
  const t = useTranslations('auth');

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    useSessionStore.getState().clear();
    window.location.href = '/login';
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-white hover:bg-red-600 bg-red-50 border border-red-200 hover:border-red-600 rounded-full transition-all duration-200 cursor-pointer shadow-sm active:scale-95"
      title={t('logout')}
      id="customer-logout-btn"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>{t('logout')}</span>
    </button>
  );
}

