import React from 'react';
import { formatMinor, FormatCurrencyOptions } from '@/lib/currency';

export interface MoneyProps extends FormatCurrencyOptions {
  minor?: number | null;
  baht?: number | null;
  className?: string;
}

/**
 * Central Reusable Money component for consistent currency display across the platform.
 * Supports satang minor integer (minor={10750}), baht decimal (baht={107.50}),
 * thousand comma separators, currency symbol, and Thai Baht text reading.
 *
 * Example: <Money minor={po.totalMinor} /> -> "฿3,745,000.00"
 * Example: <Money baht={107.50} showThaiText /> -> "฿107.50 (หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์)"
 */
export function Money({ minor, baht, className, ...options }: MoneyProps) {
  const valueMinor =
    minor !== undefined && minor !== null
      ? minor
      : baht !== undefined && baht !== null
      ? Math.round(baht * 100)
      : 0;

  return <span className={className}>{formatMinor(valueMinor, options)}</span>;
}
