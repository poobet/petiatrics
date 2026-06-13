'use client';

import { LogOut } from 'lucide-react';
import { useSessionStore } from '../../lib/session-store';

export function CustomerLogoutButton() {
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
      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
      title="Log out"
      id="customer-logout-btn"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}
