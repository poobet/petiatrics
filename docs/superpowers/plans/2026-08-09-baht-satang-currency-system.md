# Baht.Satang Currency System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Thai Baht Text conversion helper (`thaiBahtText`), formatters with Baht.Satang 2 decimal places display, and smart Baht.Satang input controls for the clinic platform starting with Accounting Rules wizard.

**Architecture:** Extend `apps/web/lib/currency.ts` with `thaiBahtText`, `formatMinorToBahtString`, and updated `formatMinor` options. Enhance `rule-form-client.tsx` to handle decimal Baht input with live Thai text preview while preserving integer Satang storage.

**Tech Stack:** TypeScript, Next.js / React (Client Components), Vitest.

---

### Task 1: Thai Baht Text & Enhanced Currency Helpers

**Files:**
- Modify: `apps/web/lib/currency.ts`
- Modify: `apps/web/lib/currency.spec.ts`

- [ ] **Step 1: Write failing tests for `thaiBahtText`, `formatMinorToBahtString`, and `formatMinor`**

Add unit tests in `apps/web/lib/currency.spec.ts`:

```typescript
import { formatMinor, parseBahtToMinor, thaiBahtText, formatMinorToBahtString } from './currency';

describe('Currency Utils - Thai Baht Text & Formatting', () => {
  describe('thaiBahtText', () => {
    it('converts 10750 satang to "หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์"', () => {
      expect(thaiBahtText(10750)).toBe('หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์');
    });

    it('converts 10700 satang to "หนึ่งร้อยเจ็ดบาทถ้วน"', () => {
      expect(thaiBahtText(10700)).toBe('หนึ่งร้อยเจ็ดบาทถ้วน');
    });

    it('converts 50 satang to "ห้าสิบสตางค์"', () => {
      expect(thaiBahtText(50)).toBe('ห้าสิบสตางค์');
    });

    it('converts 0 satang to "ศูนย์บาทถ้วน"', () => {
      expect(thaiBahtText(0)).toBe('ศูนย์บาทถ้วน');
    });

    it('converts -10750 satang to "ลบหนึ่งร้อยเจ็ดบาทห้าสิบสตางค์"', () => {
      expect(thaiBahtText(-10750)).toBe('ลบหนึ่งร้อยเจ็ดบาทห้าสิบสตางค์');
    });

    it('handles large numbers like 100000000 satang (1000000 THB) as "หนึ่งล้านบาทถ้วน"', () => {
      expect(thaiBahtText(100000000)).toBe('หนึ่งล้านบาทถ้วน');
    });

    it('handles 11 satang as "สิบเอ็ดสตางค์" and 1100 satang as "สิบเอ็ดบาทถ้วน"', () => {
      expect(thaiBahtText(11)).toBe('สิบเอ็ดสตางค์');
      expect(thaiBahtText(1100)).toBe('สิบเอ็ดบาทถ้วน');
    });

    it('handles 2100 satang as "ยี่สิบเอ็ดบาทถ้วน"', () => {
      expect(thaiBahtText(2100)).toBe('ยี่สิบเอ็ดบาทถ้วน');
    });
  });

  describe('formatMinorToBahtString', () => {
    it('formats 10750 satang to "107.50"', () => {
      expect(formatMinorToBahtString(10750)).toBe('107.50');
    });

    it('formats 0 satang to "0.00"', () => {
      expect(formatMinorToBahtString(0)).toBe('0.00');
    });

    it('formats 100 satang to "1.00"', () => {
      expect(formatMinorToBahtString(100)).toBe('1.00');
    });
  });

  describe('formatMinor options', () => {
    it('supports suffix "บาท"', () => {
      expect(formatMinor(10750, { showSymbol: false, suffix: 'บาท' })).toBe('107.50 บาท');
    });

    it('supports showThaiText option', () => {
      expect(formatMinor(10750, { showSymbol: false, suffix: 'บาท', showThaiText: true }))
        .toBe('107.50 บาท (หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์)');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/currency.spec.ts` in `apps/web`
Expected: FAIL with "thaiBahtText is not defined" or similar export errors.

- [ ] **Step 3: Implement functions in `apps/web/lib/currency.ts`**

Update `apps/web/lib/currency.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/currency.spec.ts` in `apps/web`
Expected: PASS (All tests pass)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/currency.ts apps/web/lib/currency.spec.ts
git commit -m "feat(currency): add thaiBahtText and formatMinorToBahtString helpers"
```

---

### Task 2: Accounting Rules Wizard Form Integration (`rule-form-client.tsx`)

**Files:**
- Modify: `apps/web/app/(clinic)/clinic/settings/accounting-rules/rule-form-client.tsx`

- [ ] **Step 1: Import currency helpers into `rule-form-client.tsx`**

Add imports at the top of `apps/web/app/(clinic)/clinic/settings/accounting-rules/rule-form-client.tsx`:
```typescript
import { thaiBahtText, parseBahtToMinor, formatMinorToBahtString, formatMinor } from '@/lib/currency';
```

- [ ] **Step 2: Update Step 2 (Condition Builder) input for monetary fields**

In `rule-form-client.tsx`:
1. Check if selected `formFactKey` represents a monetary value (e.g. contains `'Minor'` or `'amount'` or `'price'` or `'variance'`).
2. Add helper to check monetary fact keys:
   ```typescript
   const isMonetaryFact = (key: string) => key.toLowerCase().includes('minor') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('price');
   ```
3. Update `formValue` rendering and handling in Step 2:
   - Provide an `onBlur` formatting step so values like `100` format to `100.00` if `formValueType === 'NUMBER'` and `isMonetaryFact(formFactKey)`.
   - Directly under the Value input box in Step 2, render live Thai Baht Text preview if `formValueType === 'NUMBER'` and `isMonetaryFact(formFactKey)`:
     ```tsx
     {formValueType === 'NUMBER' && isMonetaryFact(formFactKey) && (
       <div className="text-xs font-semibold text-purple-700 bg-purple-100/70 border border-purple-200 rounded-lg px-3 py-1.5 flex items-center space-x-1.5">
         <span>💬 คำอ่าน:</span>
         <span className="font-bold">{thaiBahtText(parseBahtToMinor(formValue))}</span>
       </div>
     )}
     ```
   - When constructing `conditionsPayload` in `handleSaveRule`:
     ```typescript
     const rawNum = Number(formValue);
     // If user entered Baht decimal (e.g. 100.50), convert to minor integer satang (10050)
     const parsedValue = formValueType === 'NUMBER'
       ? (isMonetaryFact(formFactKey) ? parseBahtToMinor(formValue) : rawNum)
       : formValue;
     ```
   - When fetching existing rule data in `fetchRuleData`:
     If `isMonetaryFact(cond.fact)` and value is a number, initialize `formValue` as `formatMinorToBahtString(cond.value)` (e.g., `10000` satang -> `"100.00"` Baht).

- [ ] **Step 3: Update Step 3 (Review Summary Card)**

In Step 3 summary review card, format monetary conditions using `formatMinor`:
```tsx
{isMonetaryFact(formFactKey) && formValueType === 'NUMBER' ? (
  <span className="text-purple-700 font-mono font-bold">
    {formatMinor(parseBahtToMinor(formValue), { showSymbol: false, suffix: 'บาท', showThaiText: true })}
  </span>
) : (
  <span className="font-mono font-bold">{formValue}</span>
)}
```

- [ ] **Step 4: Verify build and test**

Run: `npx vitest run lib/currency.spec.ts` in `apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(clinic\)/clinic/settings/accounting-rules/rule-form-client.tsx
git commit -m "feat(accounting-rules): integrate Baht.Satang decimal input and Thai Baht text reading in wizard form"
```
