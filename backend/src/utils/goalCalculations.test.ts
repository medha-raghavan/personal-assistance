import {
  calculateEmi,
  loanAmortization,
  loanOutstandingSeries,
  sipFvAtMonths,
  sipFutureValue,
  goalProjection,
  buildProjectedInstallments,
  suggestTagFromName,
  normalizeTag,
  monthsBetween,
} from './goalCalculations.js';

describe('goalCalculations', () => {
  describe('calculateEmi', () => {
    it('matches standard reducing-balance EMI for known inputs', () => {
      // P=1_000_000, 8.5% p.a., 240 months ≈ 8678.35
      const emi = calculateEmi(1_000_000, 8.5, 240);
      expect(emi).toBeCloseTo(8678.35, 0);
    });

    it('returns principal/n when rate is zero', () => {
      expect(calculateEmi(120_000, 0, 12)).toBe(10_000);
    });

    it('returns 0 for invalid tenure or principal', () => {
      expect(calculateEmi(100_000, 10, 0)).toBe(0);
      expect(calculateEmi(0, 10, 12)).toBe(0);
    });
  });

  describe('loanAmortization', () => {
    it('starts at full principal with zero paid', () => {
      const snap = loanAmortization(100_000, 12, 12, 0);
      expect(snap.outstandingBalance).toBe(100_000);
      expect(snap.interestPaidToDate).toBe(0);
      expect(snap.principalPaidToDate).toBe(0);
      expect(snap.remainingMonths).toBe(12);
      expect(snap.totalPayable).toBeCloseTo(snap.emi * 12, 2);
    });

    it('reduces outstanding and tracks interest/principal after payments', () => {
      const snap = loanAmortization(100_000, 12, 12, 6);
      expect(snap.remainingMonths).toBe(6);
      expect(snap.outstandingBalance).toBeGreaterThan(0);
      expect(snap.outstandingBalance).toBeLessThan(100_000);
      expect(snap.principalPaidToDate + snap.outstandingBalance).toBeCloseTo(100_000, 0);
      expect(snap.interestPaidToDate).toBeGreaterThan(0);
    });

    it('is fully paid after tenure months', () => {
      const snap = loanAmortization(50_000, 10, 24, 24);
      expect(snap.remainingMonths).toBe(0);
      expect(snap.outstandingBalance).toBe(0);
      expect(snap.principalPaidToDate).toBeCloseTo(50_000, 0);
    });

    it('outstanding series declines to zero', () => {
      const series = loanOutstandingSeries(80_000, 9, 36);
      expect(series[0].outstanding).toBe(80_000);
      expect(series[series.length - 1].outstanding).toBe(0);
      for (let i = 1; i < series.length; i++) {
        expect(series[i].outstanding).toBeLessThanOrEqual(series[i - 1].outstanding);
      }
    });
  });

  describe('sipFutureValue', () => {
    it('computes FV for fixed tenure', () => {
      const start = new Date(2020, 0, 1);
      const asOf = new Date(2020, 0, 1);
      const result = sipFutureValue({
        monthlyAmount: 10_000,
        annualRate: 12,
        tenureMonths: 12,
        startDate: start,
        asOf,
      });
      expect(result.kind).toBe('fixed');
      if (result.kind === 'fixed') {
        expect(result.currentValue).toBe(0);
        expect(result.projectedFinalValue).toBe(sipFvAtMonths(10_000, 12, 12));
        expect(result.projectedFinalValue).toBeGreaterThan(120_000);
        expect(result.monthsRemaining).toBe(12);
      }
    });

    it('returns horizons for open-ended SIP (null tenure)', () => {
      const start = new Date(2024, 0, 15);
      const asOf = new Date(2025, 0, 15);
      const result = sipFutureValue({
        monthlyAmount: 5_000,
        annualRate: 12,
        tenureMonths: null,
        startDate: start,
        asOf,
      });
      expect(result.kind).toBe('open');
      if (result.kind === 'open') {
        expect(result.monthsElapsed).toBe(12);
        expect(result.horizons).toHaveLength(6);
        expect(result.horizons.map((h) => h.years)).toEqual([1, 5, 10, 15, 20, 25]);
        // Horizons must increase with time
        for (let i = 1; i < result.horizons.length; i++) {
          expect(result.horizons[i].value).toBeGreaterThan(result.horizons[i - 1].value);
        }
      }
    });

    it('handles zero rate as simple sum', () => {
      expect(sipFvAtMonths(1_000, 0, 10)).toBe(10_000);
    });
  });

  describe('goalProjection', () => {
    it('computes months needed and completion date when pace is set', () => {
      const asOf = new Date(2025, 0, 1);
      const proj = goalProjection(100_000, 25_000, 15_000, asOf);
      expect(proj.projectionAvailable).toBe(true);
      if (proj.projectionAvailable) {
        expect(proj.remaining).toBe(75_000);
        expect(proj.monthsNeeded).toBe(5); // ceil(75000/15000)
        expect(proj.projectedCompletionDate.getFullYear()).toBe(2025);
        expect(proj.projectedCompletionDate.getMonth()).toBe(5); // June
      }
    });

    it('skips projection when typical monthly amount is missing', () => {
      const proj = goalProjection(50_000, 10_000, null);
      expect(proj.projectionAvailable).toBe(false);
      expect(proj.remaining).toBe(40_000);
    });

    it('returns zero months when already complete', () => {
      const proj = goalProjection(10_000, 10_000, 1_000);
      expect(proj.projectionAvailable).toBe(true);
      if (proj.projectionAvailable) {
        expect(proj.monthsNeeded).toBe(0);
        expect(proj.remaining).toBe(0);
      }
    });
  });

  describe('buildProjectedInstallments', () => {
    it('caps items and returns rollup for the rest', () => {
      const start = new Date(2026, 0, 1);
      const result = buildProjectedInstallments({
        amount: 8_678,
        startFrom: start,
        count: 136,
        cap: 4,
        label: 'EMI',
      });
      expect(result.items).toHaveLength(4);
      expect(result.moreCount).toBe(132);
      expect(result.untilDate).not.toBeNull();
      expect(result.items[0].isEstimate).toBe(true);
      expect(result.items[0].amount).toBe(8_678);
    });

    it('returns empty when count is zero', () => {
      const result = buildProjectedInstallments({
        amount: 1000,
        startFrom: new Date(),
        count: 0,
      });
      expect(result.items).toHaveLength(0);
      expect(result.moreCount).toBe(0);
      expect(result.untilDate).toBeNull();
    });
  });

  describe('tag helpers', () => {
    it('suggests a slug tag from a name', () => {
      expect(suggestTagFromName('Home Loan')).toBe('#home-loan');
      expect(suggestTagFromName('  SIP Nifty 50 ')).toBe('#sip-nifty-50');
    });

    it('normalizes tags with a leading hash', () => {
      expect(normalizeTag('vacation')).toBe('#vacation');
      expect(normalizeTag('#vacation')).toBe('#vacation');
    });
  });

  describe('monthsBetween', () => {
    it('counts whole months', () => {
      expect(monthsBetween(new Date(2024, 0, 15), new Date(2025, 0, 15))).toBe(12);
      expect(monthsBetween(new Date(2024, 0, 15), new Date(2024, 1, 14))).toBe(0);
      expect(monthsBetween(new Date(2024, 0, 15), new Date(2024, 1, 15))).toBe(1);
    });
  });
});
