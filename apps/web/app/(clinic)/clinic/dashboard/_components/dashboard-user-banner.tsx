'use client';

import { useSessionStore } from '../../../../../lib/session-store';
import { LogOut, User, Building2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@petiatrics/ui';

/**
 * DashboardUserBanner — displays current user info from Zustand store.
 * Shown at the top of the clinic dashboard. Populated after store hydration.
 */
export function DashboardUserBanner() {
  const user = useSessionStore((s) => s.user);
  const activeBranch = useSessionStore((s) => s.activeBranch);

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    useSessionStore.getState().clear();
    window.location.href = '/login';
  }

  if (!user) return null;

  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="flex items-center gap-1.5 text-gray-700 font-medium">
            <User className="w-4 h-4 text-gray-400" />
            {user.email}
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium uppercase tracking-wide">
              {user.role.replace('_', ' ')}
            </span>
          </span>
          {user.clinicName && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Building2 className="w-4 h-4 text-gray-400" />
              {user.clinicName}
            </span>
          )}
          {activeBranch && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-4 h-4 text-gray-400" />
              {activeBranch.name}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </CardContent>
    </Card>
  );
}
