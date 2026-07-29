import { formatMinor, parseBahtToMinor } from './currency';

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

    it('supports omitting currency symbol', () => {
      expect(formatMinor(10700, { showSymbol: false })).toBe('107.00');
    });

    it('supports custom currency symbol', () => {
      expect(formatMinor(1000, { currencySymbol: '$' })).toBe('$10.00');
    });
  });

  describe('parseBahtToMinor', () => {
    it('parses number 107.5 to 10750 satang', () => {
      expect(parseBahtToMinor(107.5)).toBe(10750);
    });

    it('parses string "100.25" to 10025 satang', () => {
      expect(parseBahtToMinor('100.25')).toBe(10025);
    });

    it('handles invalid inputs gracefully as 0', () => {
      expect(parseBahtToMinor('abc')).toBe(0);
    });
  });
});
