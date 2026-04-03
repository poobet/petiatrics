'use client';

import { useSessionStore } from '../../lib/session-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@petiatrics/ui';
import { MapPin, ChevronDown } from 'lucide-react';

/**
 * BranchSelector — displayed in the top nav for multi-branch users only.
 *
 * Reads authorizedBranches and activeBranch from the Zustand session store.
 * Hides itself for single-branch users (exactly 1 authorized branch).
 * On selection, calls setBranch() which updates the Zustand store and
 * causes the api-client to send x-active-branch on subsequent requests.
 */
export function BranchSelector() {
  const authorizedBranches = useSessionStore((s) => s.authorizedBranches);
  const activeBranch = useSessionStore((s) => s.activeBranch);
  const setBranch = useSessionStore((s) => s.setBranch);

  // Hide for single-branch users — they're auto-assigned and need no UI
  if (authorizedBranches.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
          <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="max-w-[140px] truncate">
            {activeBranch?.name ?? 'Select branch'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-gray-500 font-normal">
          Switch branch
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {authorizedBranches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => setBranch(branch)}
            className="cursor-pointer"
          >
            <MapPin
              className={`w-4 h-4 mr-2 flex-shrink-0 ${
                activeBranch?.id === branch.id ? 'text-blue-500' : 'text-gray-400'
              }`}
            />
            <span className="truncate">{branch.name}</span>
            {activeBranch?.id === branch.id && (
              <span className="ml-auto text-xs text-blue-500 font-medium">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
