/** Pure financial-goal calculation helpers (unit-testable, no DB). */

export interface LoanAmortizationResult {
  emi: number;
  outstandingBalance: number;
  interestPaidToDate: number;
  principalPaidToDate: number;
  totalPayable: number;
  remainingMonths: number;
}

export interface SipHorizon {
  years: number;
  value: number;
  date: Date;
}

export interface SipFixedProjection {
  kind: 'fixed';
  currentValue: number;
  projectedFinalValue: number;
  projectedEndDate: Date;
  monthsElapsed: number;
  monthsRemaining: number;
}

export interface SipOpenProjection {
  kind: 'open';
  currentValue: number;
  monthsElapsed: number;
  horizons: SipHorizon[];
}

export type SipProjection = SipFixedProjection | SipOpenProjection;

export interface GoalProjectionAvailable {
  projectionAvailable: true;
  monthsNeeded: number;
  projectedCompletionDate: Date;
  remaining: number;
}

export interface GoalProjectionUnavailable {
  projectionAvailable: false;
  remaining: number;
}

export type GoalProjection = GoalProjectionAvailable | GoalProjectionUnavailable;

export interface ProjectedInstallment {
  date: Date;
  amount: number;
  isEstimate: true;
  label?: string;
}

export interface ProjectedInstallmentsResult {
  items: ProjectedInstallment[];
  moreCount: number;
  untilDate: Date | null;
}

const OPEN_SIP_HORIZON_YEARS = [1, 5, 10, 15, 20, 25] as const;

function monthlyRate(annualRate: number): number {
  return annualRate / 12 / 100;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Clamp overflow (e.g. Jan 31 + 1 month)
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

/** Whole months from start to asOf (non-negative). */
export function monthsBetween(start: Date, asOf: Date = new Date()): number {
  const startY = start.getFullYear();
  const startM = start.getMonth();
  const asOfY = asOf.getFullYear();
  const asOfM = asOf.getMonth();
  let months = (asOfY - startY) * 12 + (asOfM - startM);
  if (asOf.getDate() < start.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual_rate/12/100.
 * When rate is 0, EMI = P / n.
 */
export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (tenureMonths <= 0) return 0;
  if (principal <= 0) return 0;
  const r = monthlyRate(annualRate);
  if (r === 0) return roundMoney(principal / tenureMonths);
  const factor = Math.pow(1 + r, tenureMonths);
  return roundMoney((principal * r * factor) / (factor - 1));
}

/**
 * Reducing-balance amortization snapshot after `monthsElapsed` payments.
 */
export function loanAmortization(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  monthsElapsed: number
): LoanAmortizationResult {
  const emi = calculateEmi(principal, annualRate, tenureMonths);
  const totalPayable = roundMoney(emi * tenureMonths);
  const elapsed = Math.min(Math.max(0, monthsElapsed), tenureMonths);
  const remainingMonths = tenureMonths - elapsed;

  if (elapsed === 0) {
    return {
      emi,
      outstandingBalance: roundMoney(principal),
      interestPaidToDate: 0,
      principalPaidToDate: 0,
      totalPayable,
      remainingMonths,
    };
  }

  const r = monthlyRate(annualRate);
  let balance = principal;
  let interestPaid = 0;
  let principalPaid = 0;

  for (let i = 0; i < elapsed; i++) {
    const interest = r === 0 ? 0 : balance * r;
    const principalComponent = Math.min(emi - interest, balance);
    interestPaid += interest;
    principalPaid += principalComponent;
    balance = Math.max(0, balance - principalComponent);
  }

  return {
    emi,
    outstandingBalance: roundMoney(balance),
    interestPaidToDate: roundMoney(interestPaid),
    principalPaidToDate: roundMoney(principalPaid),
    totalPayable,
    remainingMonths,
  };
}

/** Outstanding balance series for charting (one point per month including month 0). */
export function loanOutstandingSeries(
  principal: number,
  annualRate: number,
  tenureMonths: number
): Array<{ month: number; outstanding: number }> {
  const points: Array<{ month: number; outstanding: number }> = [
    { month: 0, outstanding: roundMoney(principal) },
  ];
  for (let m = 1; m <= tenureMonths; m++) {
    const snap = loanAmortization(principal, annualRate, tenureMonths, m);
    points.push({ month: m, outstanding: snap.outstandingBalance });
  }
  return points;
}

/**
 * SIP future value of an annuity-due style monthly investment:
 * FV = M · (((1+r)^n − 1)/r) · (1+r)
 * When r = 0, FV = M · n.
 */
export function sipFvAtMonths(monthlyAmount: number, annualRate: number, n: number): number {
  if (n <= 0 || monthlyAmount <= 0) return 0;
  const r = monthlyRate(annualRate);
  if (r === 0) return roundMoney(monthlyAmount * n);
  return roundMoney(monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

export function sipFutureValue(params: {
  monthlyAmount: number;
  annualRate: number;
  tenureMonths: number | null | undefined;
  startDate: Date;
  asOf?: Date;
}): SipProjection {
  const { monthlyAmount, annualRate, tenureMonths, startDate } = params;
  const asOf = params.asOf ?? new Date();
  const monthsElapsed = monthsBetween(startDate, asOf);
  const currentValue = sipFvAtMonths(monthlyAmount, annualRate, monthsElapsed);

  if (tenureMonths == null) {
    const horizons: SipHorizon[] = OPEN_SIP_HORIZON_YEARS.map((years) => {
      const totalMonths = monthsElapsed + years * 12;
      return {
        years,
        value: sipFvAtMonths(monthlyAmount, annualRate, totalMonths),
        date: addMonths(asOf, years * 12),
      };
    });
    return { kind: 'open', currentValue, monthsElapsed, horizons };
  }

  const projectedFinalValue = sipFvAtMonths(monthlyAmount, annualRate, tenureMonths);
  const projectedEndDate = addMonths(startDate, tenureMonths);
  const monthsRemaining = Math.max(0, tenureMonths - monthsElapsed);

  return {
    kind: 'fixed',
    currentValue: sipFvAtMonths(
      monthlyAmount,
      annualRate,
      Math.min(monthsElapsed, tenureMonths)
    ),
    projectedFinalValue,
    projectedEndDate,
    monthsElapsed: Math.min(monthsElapsed, tenureMonths),
    monthsRemaining,
  };
}

/** Value series for fixed-tenure SIP charts (month 0..tenure). */
export function sipValueSeries(
  monthlyAmount: number,
  annualRate: number,
  tenureMonths: number
): Array<{ month: number; value: number }> {
  const points: Array<{ month: number; value: number }> = [];
  for (let m = 0; m <= tenureMonths; m++) {
    points.push({ month: m, value: sipFvAtMonths(monthlyAmount, annualRate, m) });
  }
  return points;
}

export function goalProjection(
  target: number,
  utilized: number,
  typicalMonthlyAmount?: number | null,
  asOf: Date = new Date()
): GoalProjection {
  const remaining = Math.max(0, roundMoney(target - utilized));
  if (remaining <= 0) {
    return {
      projectionAvailable: true,
      monthsNeeded: 0,
      projectedCompletionDate: asOf,
      remaining: 0,
    };
  }
  if (typicalMonthlyAmount == null || typicalMonthlyAmount <= 0) {
    return { projectionAvailable: false, remaining };
  }
  const monthsNeeded = Math.ceil(remaining / typicalMonthlyAmount);
  return {
    projectionAvailable: true,
    monthsNeeded,
    projectedCompletionDate: addMonths(asOf, monthsNeeded),
    remaining,
  };
}

export function buildProjectedInstallments(params: {
  amount: number;
  startFrom: Date;
  count: number;
  cap?: number;
  label?: string;
}): ProjectedInstallmentsResult {
  const cap = params.cap ?? 4;
  const { amount, startFrom, count, label } = params;
  if (count <= 0 || amount <= 0) {
    return { items: [], moreCount: 0, untilDate: null };
  }

  const items: ProjectedInstallment[] = [];
  const show = Math.min(cap, count);
  for (let i = 0; i < show; i++) {
    items.push({
      date: addMonths(startFrom, i),
      amount: roundMoney(amount),
      isEstimate: true,
      label,
    });
  }

  const moreCount = Math.max(0, count - show);
  const untilDate = moreCount > 0 ? addMonths(startFrom, count - 1) : null;

  return { items, moreCount, untilDate };
}

/** Normalize a goal name into a #tag slug. */
export function suggestTagFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `#${slug}` : '#goal';
}

export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '#goal';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

export { addMonths, OPEN_SIP_HORIZON_YEARS };
