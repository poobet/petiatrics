export interface FormatCurrencyOptions {
  currencySymbol?: string;
  showSymbol?: boolean;
  minimumFractionDigits?: number;
  suffix?: string;
  showThaiText?: boolean;
}

const THAI_NUMBERS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const THAI_UNITS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

/**
 * Converts minor satang units (integer) to Thai text reading (BahtText).
 * Example: 10750 -> "หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์"
 * Example: 10700 -> "หนึ่งร้อยเจ็ดบาทถ้วน"
 * Example: 50 -> "ห้าสิบสตางค์"
 * Example: 0 -> "ศูนย์บาทถ้วน"
 */
export function thaiBahtText(minor: number): string {
  if (isNaN(minor) || !isFinite(minor)) return 'ศูนย์บาทถ้วน';

  const isNegative = minor < 0;
  const absSatang = Math.abs(Math.round(minor));

  if (absSatang === 0) return 'ศูนย์บาทถ้วน';

  const baht = Math.floor(absSatang / 100);
  const satang = absSatang % 100;

  function convertSection(num: number): string {
    if (num === 0) return '';
    let result = '';
    const str = num.toString();
    const len = str.length;

    for (let i = 0; i < len; i++) {
      const digit = parseInt(str[i], 10);
      const pos = len - i - 1;

      if (digit === 0) continue;

      if (pos === 0 && digit === 1 && len > 1) {
        result += 'เอ็ด';
      } else if (pos === 1 && digit === 1) {
        result += 'สิบ';
      } else if (pos === 1 && digit === 2) {
        result += 'ยี่สิบ';
      } else {
        result += THAI_NUMBERS[digit] + THAI_UNITS[pos];
      }
    }
    return result;
  }

  function convertBigNumber(num: number): string {
    if (num === 0) return '';
    let result = '';
    let remaining = num;
    let millionCount = 0;

    while (remaining > 0) {
      const chunk = remaining % 1000000;
      if (chunk > 0) {
        const chunkText = convertSection(chunk);
        const millions = 'ล้าน'.repeat(millionCount);
        result = chunkText + millions + result;
      }
      remaining = Math.floor(remaining / 1000000);
      millionCount++;
    }
    return result;
  }

  let text = isNegative ? 'ลบ' : '';

  if (baht > 0) {
    text += convertBigNumber(baht) + 'บาท';
    if (satang === 0) {
      text += 'ถ้วน';
    } else {
      text += convertSection(satang) + 'สตางค์';
    }
  } else {
    text += convertSection(satang) + 'สตางค์';
  }

  return text;
}

/**
 * Converts minor satang units (integer) to formatted Baht currency string.
 * Example: 10750 -> "฿107.50" or "107.50 บาท (หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์)"
 */
export function formatMinor(minor: number, options: FormatCurrencyOptions = {}): string {
  const {
    currencySymbol = '฿',
    showSymbol = true,
    minimumFractionDigits = 2,
    suffix,
    showThaiText = false,
  } = options;

  const baht = (minor || 0) / 100;
  const formattedNumber = baht.toFixed(minimumFractionDigits);

  let formatted = showSymbol ? `${currencySymbol}${formattedNumber}` : formattedNumber;

  if (suffix) {
    formatted = `${formatted} ${suffix}`;
  }

  if (showThaiText) {
    const thaiText = thaiBahtText(minor);
    formatted = `${formatted} (${thaiText})`;
  }

  return formatted;
}

/**
 * Converts minor satang units to fixed 2 decimal Baht string for UI form inputs.
 * Example: 10750 -> "107.50"
 */
export function formatMinorToBahtString(minor: number): string {
  const baht = (minor || 0) / 100;
  return baht.toFixed(2);
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

