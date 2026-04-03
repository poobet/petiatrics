import { create } from 'zustand';
import type { AuthProfile, BranchSummary } from '@petiatrics/types';

interface SessionState {
  user: AuthProfile | null;
  authorizedBranches: BranchSummary[];
  activeBranch: BranchSummary | null;

  /**
   * Hydrate the store from a login or /auth/me response.
   * Auto-selects the first branch for single-branch users.
   */
  hydrate: (profile: AuthProfile) => void;

  /**
   * Update the active branch (from the branch selector dropdown).
   */
  setBranch: (branch: BranchSummary) => void;

  /**
   * Clear all state on logout or 401.
   */
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  authorizedBranches: [],
  activeBranch: null,

  hydrate: (profile: AuthProfile) => {
    const branches = profile.branches ?? [];
    const current = get().activeBranch;
    // Preserve current selection when it is still in the authorized list
    const stillValid = current !== null && branches.some((b) => b.id === current.id);
    set({
      user: profile,
      authorizedBranches: branches,
      activeBranch: stillValid ? current : (branches[0] ?? null),
    });
  },

  setBranch: (branch: BranchSummary) => {
    set({ activeBranch: branch });
  },

  clear: () => {
    set({ user: null, authorizedBranches: [], activeBranch: null });
  },
}));
