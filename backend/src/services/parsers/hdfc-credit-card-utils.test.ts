import {
  isCreditCardCsvHeaders,
  isCreditCardDate,
  isCreditCardXlsHeaderRow,
  mapCreditCardColumns,
  parseCreditCardAmount,
  parseCreditCardDate,
  resolveCreditCardType,
} from './hdfc-credit-card-utils.js';

describe('hdfc-credit-card-utils', () => {
  describe('isCreditCardCsvHeaders', () => {
    it('detects PDF-derived credit card CSV headers', () => {
      expect(
        isCreditCardCsvHeaders(['Date', 'Description', 'Amount', 'Type', 'DR/CR', 'Card Number'])
      ).toBe(true);
    });

    it('rejects bank account CSV headers', () => {
      expect(
        isCreditCardCsvHeaders([
          'Date',
          'Description',
          'Reference',
          'Value Date',
          'Withdrawal',
          'Deposit',
          'Balance',
        ])
      ).toBe(false);
    });
  });

  describe('isCreditCardXlsHeaderRow', () => {
    it('detects sparse Excel credit card header row', () => {
      const rowStr =
        'transaction type||||primary / addon customer name||||date & time|||description|||||||rewards||amt|||debit / credit';
      expect(isCreditCardXlsHeaderRow(rowStr)).toBe(true);
    });
  });

  describe('mapCreditCardColumns', () => {
    it('maps Excel sparse header columns', () => {
      const row = [
        'Transaction type',
        null,
        null,
        null,
        'Primary / Addon Customer Name',
        null,
        null,
        null,
        null,
        'Date & Time',
        null,
        null,
        'Description',
        null,
        null,
        null,
        null,
        null,
        'REWARDS',
        null,
        'AMT',
        null,
        null,
        'Debit / Credit',
      ];

      expect(mapCreditCardColumns(row)).toEqual({
        txnType: 0,
        date: 9,
        description: 12,
        amount: 20,
        type: 23,
      });
    });
  });

  describe('parseCreditCardDate', () => {
    it('parses DD-Mon-YYYY from PDF CSV', () => {
      const date = parseCreditCardDate('02-Apr-2023');
      expect(date.getFullYear()).toBe(2023);
      expect(date.getMonth()).toBe(3);
      expect(date.getDate()).toBe(2);
    });

    it('parses DD/MM/YYYY with time suffix from Excel', () => {
      const date = parseCreditCardDate('23/03/2026 / 20:51');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2);
      expect(date.getDate()).toBe(23);
    });

    it('parses DD/MM/YYYY without time', () => {
      const date = parseCreditCardDate('23/03/2026');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2);
      expect(date.getDate()).toBe(23);
    });
  });

  describe('isCreditCardDate', () => {
    it('accepts credit card date formats', () => {
      expect(isCreditCardDate('02-Apr-2023')).toBe(true);
      expect(isCreditCardDate('23/03/2026 / 20:51')).toBe(true);
      expect(isCreditCardDate('23/03/2026')).toBe(true);
    });

    it('rejects invalid values', () => {
      expect(isCreditCardDate('')).toBe(false);
      expect(isCreditCardDate('not a date')).toBe(false);
    });
  });

  describe('parseCreditCardAmount', () => {
    it('parses comma-separated amounts', () => {
      expect(parseCreditCardAmount('45,044.00')).toBe(45044);
      expect(parseCreditCardAmount('648.74')).toBe(648.74);
    });
  });

  describe('resolveCreditCardType', () => {
    const columnMap = { type: 0, txnType: 1 };

    it('resolves DR/CR column values', () => {
      expect(resolveCreditCardType(['DR'], { type: 0 }, 'UBER')).toBe('debit');
      expect(resolveCreditCardType(['CR'], { type: 0 }, 'UBER')).toBe('credit');
      expect(resolveCreditCardType(['Cr'], { type: 0 }, 'PAYMENT')).toBe('credit');
      expect(resolveCreditCardType([''], { type: 0 }, 'UBER')).toBe('debit');
    });

    it('resolves CSV row fields', () => {
      expect(
        resolveCreditCardType(
          { 'DR/CR': 'DR', Type: 'debit', Description: 'UBER' },
          {},
          'UBER'
        )
      ).toBe('debit');
      expect(
        resolveCreditCardType(
          { 'DR/CR': 'CR', Type: 'credit', Description: 'IMPS PMT' },
          {},
          'IMPS PMT'
        )
      ).toBe('credit');
    });

    it('falls back to payment keywords in description', () => {
      expect(resolveCreditCardType([], {}, 'BPPY CC PAYMENT')).toBe('credit');
      expect(resolveCreditCardType([], {}, 'UBER INDIA')).toBe('debit');
    });
  });
});
