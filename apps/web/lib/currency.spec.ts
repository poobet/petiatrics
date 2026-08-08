import { formatMinor, parseBahtToMinor, thaiBahtText, formatMinorToBahtString } from './currency';

describe('Currency Utils', () => {
  describe('formatMinor', () => {
    it('formats 10700 satang as "฿107.00"', () => {
      expect(formatMinor(10700)).toBe('฿107.00');
    });

    it('formats 0 satang as "฿0.00"', () => {
      expect(formatMinor(0)).toBe('฿0.00');
    });

    it('formats 50 satang as "฿0.50"', () => {
      expect(formatMinor(50)).toBe('฿0.50');
    });

    it('supports thousand comma separators e.g. 100,000.00', () => {
      expect(formatMinor(10000000)).toBe('฿100,000.00');
      expect(formatMinor(123456789)).toBe('฿1,234,567.89');
    });

    it('supports omitting currency symbol', () => {
      expect(formatMinor(10700, { showSymbol: false })).toBe('107.00');
    });

    it('supports custom currency symbol', () => {
      expect(formatMinor(1000, { currencySymbol: '$' })).toBe('$10.00');
    });

    it('supports suffix "บาท"', () => {
      expect(formatMinor(10750, { showSymbol: false, suffix: 'บาท' })).toBe('107.50 บาท');
    });

    it('supports showThaiText option with thousand separators', () => {
      expect(formatMinor(10000050, { showSymbol: false, suffix: 'บาท', showThaiText: true }))
        .toBe('100,000.50 บาท (หนึ่งแสนบาทห้าสิบสตางค์)');
    });
  });

  describe('parseBahtToMinor', () => {
    it('parses number 107.5 to 10750 satang', () => {
      expect(parseBahtToMinor(107.5)).toBe(10750);
    });

    it('parses string "100.25" to 10025 satang', () => {
      expect(parseBahtToMinor('100.25')).toBe(10025);
    });

    it('parses string with commas "1,000.50" to 100050 satang', () => {
      expect(parseBahtToMinor('1,000.50')).toBe(100050);
      expect(parseBahtToMinor('1,234,567.89')).toBe(123456789);
    });

    it('handles invalid inputs gracefully as 0', () => {
      expect(parseBahtToMinor('abc')).toBe(0);
    });
  });

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

    it('formats 10000000 satang with commas to "100,000.00"', () => {
      expect(formatMinorToBahtString(10000000)).toBe('100,000.00');
    });

    it('formats 0 satang to "0.00"', () => {
      expect(formatMinorToBahtString(0)).toBe('0.00');
    });

    it('formats 100 satang to "1.00"', () => {
      expect(formatMinorToBahtString(100)).toBe('1.00');
    });
  });
});
