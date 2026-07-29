export interface FormatCurrencyOptions {
  currencySymbol?: string;
  showSymbol?: boolean;
  minimumFractionDigits?: number;
}

/**
 * Converts minor satang units (integer) to formatted Baht currency string.
 * Example: 10700 -> "฿107.00"
 */
export function formatMinor(minor: number, options: FormatCurrencyOptions = {}): string {
  const { currencySymbol = '฿', showSymbol = true, minimumFractionDigits = 2 } = options;
  const baht = (minor || 0) / 100;
  const formatted = baht.toFixed(minimumFractionDigits);
  return showSymbol ? `${currencySymbol}${formatted}` : formatted;
}

/**
 * Converts decimal Baht to minor satang integer safely.
 * Example: 107.5 -> 10750
 */
export function parseBahtToMinor(baht: number | string): number {
  const val = typeof baht === 'string' ? parseFloat(baht) : baht;
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}
