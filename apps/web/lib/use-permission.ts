'use client';

import { useSessionStore } from './session-store';

/**
 * Returns true if the current user has the specified permission.
 * SUPER_ADMIN always returns true regardless of explicit permission list.
 */
export function usePermission(permission: string): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return (user.permissions ?? []).includes(permission);
}

/**
 * Returns true if the current user has ALL of the specified permissions.
 * SUPER_ADMIN always returns true regardless of explicit permission list.
 */
export function usePermissions(permissions: string[]): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  const userPerms = user.permissions ?? [];
  return permissions.every((p) => userPerms.includes(p));
}
