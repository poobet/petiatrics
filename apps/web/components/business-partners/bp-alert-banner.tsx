'use client';

import { AlertTriangle } from 'lucide-react';

interface BpAlertBannerProps {
  message: string;
}

/**
 * Displays a yellow warning banner when a BP has an alertMessage set.
 * Rendered above the tab panel in business-partner-form.tsx.
 */
export default function BpAlertBanner({ message }: BpAlertBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
