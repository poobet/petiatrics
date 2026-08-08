# Baht.Satang Currency System & Thai Baht Text Design Spec

**Date:** 2026-08-09  
**Status:** Approved by User  
**Topic:** Baht.Satang Currency Formatting, Thai Baht Text Conversion, and Smart Form Controls  

---

## 1. Overview & Context

Currently, monetary amounts across the Pediatrics Clinic platform are stored in the smallest currency unit (**minor integer unit / Satang**, where 1 THB = 100 Satang, e.g., 107.50 THB is stored as `10750`).

To improve user experience and clarity:
1. Users should be able to enter monetary values in **Baht.Satang decimal format** (e.g., `107.50`) on UI forms.
2. The UI will automatically display a **live Thai Baht Text preview** (e.g., `หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์` or `หนึ่งร้อยบาทถ้วน`) under currency input fields.
3. System outputs and summary cards (such as the Dynamic Accounting Rules wizard) will format monetary values consistently with 2 decimal places and optional Thai Baht Text reading.
4. When saving to the database or sending payloads to backend API endpoints, decimal inputs (e.g., `107.50`) are safely converted to minor integer units (`10750` Satang), preserving exact precision without floating-point rounding errors.

---

## 2. Core Utilities & Helper Enhancements (`apps/web/lib/currency.ts`)

We extend `apps/web/lib/currency.ts` with the following comprehensive utility functions:

### 2.1 `thaiBahtText(minor: number): string`
Converts Satang integers (or Baht decimal amounts converted to Satang) into grammatically accurate Thai text representations.

* **Algorithm & Formatting Rules:**
  - `10750` Satang (107.50 Baht) ➔ `"หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์"`
  - `10700` Satang (107.00 Baht) ➔ `"หนึ่งร้อยเจ็ดบาทถ้วน"`
  - `50` Satang (0.50 Baht) ➔ `"ห้าสิบสตางค์"`
  - `0` Satang (0.00 Baht) ➔ `"ศูนย์บาทถ้วน"`
  - `-10750` Satang (-107.50 Baht) ➔ `"ลบหนึ่งร้อยเจ็ดบาทห้าสิบสตางค์"`
  - Thai digit words: `ศูนย์`, `หนึ่ง`, `สอง`, `สาม`, `สี่`, `ห้า`, `หก`, `เจ็ด`, `แปด`, `เก้า`
  - Position words: `สิบ`, `ร้อย`, `พัน`, `หมื่น`, `แสน`, `ล้าน`
  - Rules for `เอ็ด` (e.g., `11` ➔ `สิบเอ็ด`, `101` ➔ `หนึ่งร้อยเอ็ด`, except `1` ➔ `หนึ่ง`)
  - Rules for `ยี่` (e.g., `20` ➔ `ยี่สิบ`)

### 2.2 `formatMinor(minor: number, options?: FormatCurrencyOptions): string`
Formats minor Satang units into formatted Baht strings with exact 2 decimal places.

* **Extended Options (`FormatCurrencyOptions`):**
  - `currencySymbol?: string` (default: `'฿'`)
  - `showSymbol?: boolean` (default: `true`)
  - `minimumFractionDigits?: number` (default: `2`)
  - `suffix?: string` (e.g., `'บาท'`)
  - `showThaiText?: boolean` (default: `false` — appends `(ตัวหนังสือภาษาไทย)`)

### 2.3 `formatMinorToBahtString(minor: number): string`
Converts Satang integer `10750` to input string `"107.50"` with fixed 2 decimal places for initializing UI text boxes.

### 2.4 `parseBahtToMinor(bahtInput: string | number): number`
Parses user decimal Baht input (e.g., `"107.50"`, `"107.5"`, `"107"`) to minor integer Satang (`10750`) safely using `Math.round(parseFloat(input) * 100)`. Handles empty or invalid inputs by returning `0`.

---

## 3. UI Component & Accounting Rule Form Integration

### 3.1 Smart Baht-Satang Currency Input Helper / Component
* **Input Behavior:**
  - Allows typing numbers with 2 decimal places (e.g. `107.50`).
  - On blur (`onBlur`), automatically formats text to 2 decimal places (e.g., `107.5` ➔ `107.50`).
  - Displays live Thai Baht Text helper directly beneath input (e.g., `💬 หนึ่งร้อยเจ็ดบาทห้าสิบสตางค์`).
  - Emits/stores integer Satang (`10750`) in state for backend saving.

### 3.2 Dynamic Accounting Rules Wizard (`apps/web/app/(clinic)/clinic/settings/accounting-rules/rule-form-client.tsx`)
* **Step 2 (Condition Builder):**
  - For monetary fact keys (e.g., `varianceAmountMinor`, `totalAmountMinor`, `unitPriceMinor`), change value input from raw Satang integer to Baht.Satang decimal input (`100.00` Baht instead of `10000` Satang).
  - Include live Thai text preview under the input box.
  - Automatically convert decimal Baht input to Satang integer in the rule JSON payload when saving.
* **Step 3 (GL Action & Review Summary Card):**
  - Format monetary conditions clearly with 2 decimal places and Thai text reading:
    `varianceAmountMinor <= 100.00 บาท (หนึ่งร้อยบาทถ้วน)` instead of displaying raw `10000`.

---

## 4. Verification & Unit Testing

- Add unit test suite in `apps/web/lib/currency.spec.ts` testing:
  - `thaiBahtText` for various amounts (0, whole Bahts, Baht + Satang, Satang-only, large numbers, negative values).
  - `formatMinorToBahtString` ensuring 2 decimal places format.
  - `formatMinor` with `showThaiText` and custom suffixes.
  - `parseBahtToMinor` with decimals, whole numbers, strings, and edge cases.
- Verify `rule-form-client.tsx` wizard rendering, input handling, and summary formatting.
