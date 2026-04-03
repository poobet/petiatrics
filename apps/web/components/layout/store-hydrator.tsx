'use client';

import { useEffect } from 'react';
import { useSessionStore } from '../../lib/session-store';
import type { AuthProfile } from '@petiatrics/types';

/**
 * StoreHydrator — re-hydrates the Zustand session store from the
 * server-fetched AuthProfile on every page navigation. This ensures
 * client components (dashboards, branch selector) always have fresh
 * user/branch data without an extra API call.
 *
 * Renders nothing — purely a side-effect component.
 */
export function StoreHydrator({ profile }: { profile: AuthProfile }) {
  // Run after every render so navigations within the layout re-hydrate the store.
  // hydrate() preserves the current activeBranch if it is still valid.
  useEffect(() => {
    useSessionStore.getState().hydrate(profile);
  });

  return null;
}
