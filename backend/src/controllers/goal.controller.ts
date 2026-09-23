import { Response, NextFunction } from 'express';
import { Goal, IGoal, GoalType, IGoalDetailsGoal, IGoalDetailsLoan, IGoalDetailsSip } from '../models/Goal.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  calculateEmi,
  loanAmortization,
  loanOutstandingSeries,
  sipFutureValue,
  sipValueSeries,
  goalProjection,
  buildProjectedInstallments,
  monthsBetween,
  normalizeTag,
  suggestTagFromName,
  addMonths,
} from '../utils/goalCalculations.js';

interface MatchedTx {
  _id: string;
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum absolute amounts of transactions tagged with the goal tag (live, never cached). */
async function sumTaggedAmount(userId: string, tag: string): Promise<{ total: number; transactions: MatchedTx[] }> {
  const txs = await Transaction.find({ userId, tags: tag })
    .sort({ transactionDate: -1 })
    .select('_id transactionDate amount type description')
    .lean();

  const transactions: MatchedTx[] = txs.map((t) => ({
    _id: String(t._id),
    date: new Date(t.transactionDate).toISOString(),
    amount: t.amount,
    type: t.type as 'credit' | 'debit',
    description: t.description,
  }));

  const total = roundMoney(transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0));
  return { total, transactions };
}

function validateDetails(type: GoalType, details: Record<string, unknown>): IGoalDetailsGoal | IGoalDetailsLoan | IGoalDetailsSip {
  if (type === 'goal') {
    const targetAmount = Number(details.targetAmount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      throw new ApiError(400, 'goal details require a positive targetAmount');
    }
    return {
      targetAmount,
      targetDate: details.targetDate ? new Date(String(details.targetDate)) : null,
      typicalMonthlyAmount:
        details.typicalMonthlyAmount != null && details.typicalMonthlyAmount !== ''
          ? Number(details.typicalMonthlyAmount)
          : null,
    };
  }

  if (type === 'loan') {
    const principal = Number(details.principal);
    const annualRate = Number(details.annualRate);
    const tenureMonths = Number(details.tenureMonths);
    if (!Number.isFinite(principal) || principal <= 0) {
      throw new ApiError(400, 'loan details require a positive principal');
    }
    if (!Number.isFinite(annualRate) || annualRate < 0) {
      throw new ApiError(400, 'loan details require a non-negative annualRate');
    }
    if (!Number.isFinite(tenureMonths) || tenureMonths <= 0) {
      throw new ApiError(400, 'loan details require a positive tenureMonths');
    }
    if (!details.startDate) {
      throw new ApiError(400, 'loan details require startDate');
    }
    return {
      principal,
      annualRate,
      tenureMonths: Math.floor(tenureMonths),
      startDate: new Date(String(details.startDate)),
    };
  }

  // sip
  const monthlyAmount = Number(details.monthlyAmount);
  const annualRate = Number(details.annualRate);
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
    throw new ApiError(400, 'sip details require a positive monthlyAmount');
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new ApiError(400, 'sip details require a non-negative annualRate');
  }
  if (!details.startDate) {
    throw new ApiError(400, 'sip details require startDate');
  }
  const hasTenure =
    details.tenureMonths != null &&
    details.tenureMonths !== '' &&
    !(typeof details.tenureMonths === 'number' && Number.isNaN(details.tenureMonths));
  const tenureMonths = hasTenure ? Math.floor(Number(details.tenureMonths)) : null;
  if (tenureMonths != null && (!Number.isFinite(tenureMonths) || tenureMonths <= 0)) {
    throw new ApiError(400, 'sip tenureMonths must be a positive integer or omitted for an ongoing SIP');
  }
  return {
    monthlyAmount,
    annualRate,
    tenureMonths,
    startDate: new Date(String(details.startDate)),
  };
}

function buildListProgress(goal: IGoal, taggedTotal: number) {
  if (goal.type === 'goal') {
    const d = goal.details as IGoalDetailsGoal;
    const target = d.targetAmount;
    const utilized = taggedTotal;
    const percent = target > 0 ? Math.min(100, roundMoney((utilized / target) * 100)) : 0;
    return {
      utilized,
      target,
      remaining: Math.max(0, roundMoney(target - utilized)),
      progressPercent: percent,
      summaryAmount: `${formatInr(utilized)} / ${formatInr(target)}`,
      isComplete: utilized >= target,
      isOpenEnded: false,
    };
  }

  if (goal.type === 'loan') {
    const d = goal.details as IGoalDetailsLoan;
    const principalRepaid = taggedTotal;
    const percent = d.principal > 0 ? Math.min(100, roundMoney((principalRepaid / d.principal) * 100)) : 0;
    return {
      principalRepaid,
      principal: d.principal,
      remaining: Math.max(0, roundMoney(d.principal - principalRepaid)),
      progressPercent: percent,
      summaryAmount: `${formatInr(principalRepaid)} repaid of ${formatInr(d.principal)}`,
      isComplete: principalRepaid >= d.principal,
      isOpenEnded: false,
    };
  }

  // sip
  const d = goal.details as IGoalDetailsSip;
  const invested = taggedTotal;
  const isOpenEnded = d.tenureMonths == null;
  if (isOpenEnded) {
    return {
      invested,
      progressPercent: null as number | null,
      summaryAmount: `${formatInr(invested)} invested`,
      isComplete: false,
      isOpenEnded: true,
    };
  }
  const expectedTotal = d.monthlyAmount * (d.tenureMonths as number);
  const percent = expectedTotal > 0 ? Math.min(100, roundMoney((invested / expectedTotal) * 100)) : 0;
  return {
    invested,
    expectedTotal,
    progressPercent: percent,
    summaryAmount: `${formatInr(invested)} / ${formatInr(expectedTotal)} invested`,
    isComplete: invested >= expectedTotal,
    isOpenEnded: false,
  };
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function buildDetailExtras(
  goal: IGoal,
  taggedTotal: number,
  history: MatchedTx[]
) {
  const now = new Date();

  if (goal.type === 'goal') {
    const d = goal.details as IGoalDetailsGoal;
    const projection = goalProjection(d.targetAmount, taggedTotal, d.typicalMonthlyAmount ?? null, now);
    const remaining = Math.max(0, d.targetAmount - taggedTotal);
    const isComplete = remaining <= 0;

    let projected = buildProjectedInstallments({
      amount: 0,
      startFrom: now,
      count: 0,
    });

    if (!isComplete && projection.projectionAvailable && d.typicalMonthlyAmount) {
      projected = buildProjectedInstallments({
        amount: d.typicalMonthlyAmount,
        startFrom: addMonths(now, 1),
        count: projection.monthsNeeded,
        cap: 4,
        label: 'Contribution',
      });
    }

    return {
      stats: {
        utilized: taggedTotal,
        target: d.targetAmount,
        remaining: roundMoney(remaining),
        targetDate: d.targetDate ?? null,
        typicalMonthlyAmount: d.typicalMonthlyAmount ?? null,
        projection,
      },
      chart: null,
      projected: {
        items: projected.items.map((i) => ({
          date: i.date.toISOString(),
          amount: i.amount,
          isEstimate: true as const,
          label: i.label,
        })),
        moreCount: projected.moreCount,
        untilDate: projected.untilDate?.toISOString() ?? null,
      },
      historyEmpty: history.length === 0,
    };
  }

  if (goal.type === 'loan') {
    const d = goal.details as IGoalDetailsLoan;
    const monthsElapsed = Math.min(monthsBetween(d.startDate, now), d.tenureMonths);
    const amort = loanAmortization(d.principal, d.annualRate, d.tenureMonths, monthsElapsed);
    const isComplete = taggedTotal >= d.principal || amort.remainingMonths <= 0;

    let projected = buildProjectedInstallments({
      amount: 0,
      startFrom: now,
      count: 0,
    });

    if (!isComplete && amort.remainingMonths > 0) {
      projected = buildProjectedInstallments({
        amount: amort.emi,
        startFrom: addMonths(d.startDate, monthsElapsed + 1),
        count: amort.remainingMonths,
        cap: 4,
        label: 'EMI',
      });
    }

    const interestRemaining = roundMoney(
      Math.max(0, amort.totalPayable - d.principal - amort.interestPaidToDate)
    );

    return {
      stats: {
        principal: d.principal,
        principalRepaid: taggedTotal,
        outstandingBalance: amort.outstandingBalance,
        emi: amort.emi,
        annualRate: d.annualRate,
        tenureMonths: d.tenureMonths,
        monthsElapsed,
        remainingMonths: amort.remainingMonths,
        interestPaidToDate: amort.interestPaidToDate,
        interestRemaining,
        principalPaidToDate: amort.principalPaidToDate,
        totalPayable: amort.totalPayable,
        startDate: d.startDate,
      },
      chart: {
        type: 'loan_outstanding' as const,
        series: loanOutstandingSeries(d.principal, d.annualRate, d.tenureMonths),
      },
      projected: {
        items: projected.items.map((i) => ({
          date: i.date.toISOString(),
          amount: i.amount,
          isEstimate: true as const,
          label: i.label,
        })),
        moreCount: projected.moreCount,
        untilDate: projected.untilDate?.toISOString() ?? null,
      },
      historyEmpty: history.length === 0,
    };
  }

  // sip
  const d = goal.details as IGoalDetailsSip;
  const sip = sipFutureValue({
    monthlyAmount: d.monthlyAmount,
    annualRate: d.annualRate,
    tenureMonths: d.tenureMonths ?? null,
    startDate: d.startDate,
    asOf: now,
  });

  const isOpenEnded = d.tenureMonths == null;
  const isComplete =
    !isOpenEnded &&
    sip.kind === 'fixed' &&
    (sip.monthsRemaining <= 0 || taggedTotal >= d.monthlyAmount * (d.tenureMonths as number));

  let projected = buildProjectedInstallments({
    amount: 0,
    startFrom: now,
    count: 0,
  });

  if (!isComplete) {
    if (isOpenEnded) {
      // Show next 4 monthly debits; rollup is open-ended so no untilDate
      projected = buildProjectedInstallments({
        amount: d.monthlyAmount,
        startFrom: addMonths(d.startDate, sip.monthsElapsed + 1),
        count: 4,
        cap: 4,
        label: 'SIP',
      });
      projected = { ...projected, moreCount: 0, untilDate: null };
    } else if (sip.kind === 'fixed' && sip.monthsRemaining > 0) {
      projected = buildProjectedInstallments({
        amount: d.monthlyAmount,
        startFrom: addMonths(d.startDate, sip.monthsElapsed + 1),
        count: sip.monthsRemaining,
        cap: 4,
        label: 'SIP',
      });
    }
  }

  return {
    stats: {
      invested: taggedTotal,
      monthlyAmount: d.monthlyAmount,
      annualRate: d.annualRate,
      tenureMonths: d.tenureMonths ?? null,
      startDate: d.startDate,
      isOpenEnded,
      sip,
      gainVsInvested: roundMoney(sip.currentValue - taggedTotal),
    },
    chart: isOpenEnded
      ? {
          type: 'sip_horizons' as const,
          horizons:
            sip.kind === 'open'
              ? sip.horizons.map((h) => ({
                  years: h.years,
                  value: h.value,
                  date: h.date.toISOString(),
                }))
              : [],
        }
      : {
          type: 'sip_value' as const,
          series: sipValueSeries(d.monthlyAmount, d.annualRate, d.tenureMonths as number),
          projectedEndDate:
            sip.kind === 'fixed' ? sip.projectedEndDate.toISOString() : null,
        },
    projected: {
      items: projected.items.map((i) => ({
        date: i.date.toISOString(),
        amount: i.amount,
        isEstimate: true as const,
        label: i.label,
      })),
      moreCount: projected.moreCount,
      untilDate: projected.untilDate?.toISOString() ?? null,
    },
    historyEmpty: history.length === 0,
  };
}

export async function getGoals(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const goals = await Goal.find({ userId: req.userId }).sort({ createdAt: -1 });

    const data = await Promise.all(
      goals.map(async (goal) => {
        const { total } = await sumTaggedAmount(String(req.userId), goal.tag);
        const progress = buildListProgress(goal, total);
        return {
          _id: goal._id,
          name: goal.name,
          tag: goal.tag,
          type: goal.type,
          icon: goal.icon,
          details: goal.details,
          createdAt: goal.createdAt,
          updatedAt: goal.updatedAt,
          progress,
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getGoalById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      throw new ApiError(404, 'Goal not found');
    }

    const { total, transactions } = await sumTaggedAmount(String(req.userId), goal.tag);
    const progress = buildListProgress(goal, total);
    const extras = buildDetailExtras(goal, total, transactions);

    res.json({
      success: true,
      data: {
        _id: goal._id,
        name: goal.name,
        tag: goal.tag,
        type: goal.type,
        icon: goal.icon,
        details: goal.details,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        progress,
        stats: extras.stats,
        chart: extras.chart,
        history: transactions.map((t) => ({
          _id: t._id,
          date: t.date,
          amount: t.amount,
          type: t.type,
          description: t.description,
        })),
        historyEmpty: extras.historyEmpty,
        projected: extras.projected,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createGoal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, type, icon, tag, details } = req.body as {
      name?: string;
      type?: GoalType;
      icon?: string;
      tag?: string;
      details?: Record<string, unknown>;
    };

    if (!name?.trim()) {
      throw new ApiError(400, 'name is required');
    }
    if (!type || !['goal', 'loan', 'sip'].includes(type)) {
      throw new ApiError(400, 'type must be goal, loan, or sip');
    }
    if (!details || typeof details !== 'object') {
      throw new ApiError(400, 'details are required');
    }

    const normalizedTag = normalizeTag(tag?.trim() || suggestTagFromName(name));
    const existing = await Goal.findOne({ userId: req.userId, tag: normalizedTag });
    if (existing) {
      throw new ApiError(409, `A goal with tag ${normalizedTag} already exists`);
    }

    const validatedDetails = validateDetails(type, details);

    const goal = new Goal({
      userId: req.userId,
      name: name.trim(),
      tag: normalizedTag,
      type,
      icon: icon?.trim() || defaultIcon(type),
      details: validatedDetails,
    });

    await goal.save();

    const progress = buildListProgress(goal, 0);

    res.status(201).json({
      success: true,
      data: {
        _id: goal._id,
        name: goal.name,
        tag: goal.tag,
        type: goal.type,
        icon: goal.icon,
        details: goal.details,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateGoal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const goal = await Goal.findOne({ _id: id, userId: req.userId });
    if (!goal) {
      throw new ApiError(404, 'Goal not found');
    }

    const { name, icon, tag, details } = req.body as {
      name?: string;
      icon?: string;
      tag?: string;
      details?: Record<string, unknown>;
    };

    if (name !== undefined) {
      if (!name.trim()) throw new ApiError(400, 'name cannot be empty');
      goal.name = name.trim();
    }
    if (icon !== undefined) {
      goal.icon = icon.trim() || goal.icon;
    }
    if (tag !== undefined) {
      const normalizedTag = normalizeTag(tag);
      if (normalizedTag !== goal.tag) {
        const clash = await Goal.findOne({
          userId: req.userId,
          tag: normalizedTag,
          _id: { $ne: goal._id },
        });
        if (clash) {
          throw new ApiError(409, `A goal with tag ${normalizedTag} already exists`);
        }
        goal.tag = normalizedTag;
      }
    }
    if (details !== undefined) {
      // Type is immutable; re-validate against existing type
      goal.details = validateDetails(goal.type, {
        ...(goal.details as unknown as Record<string, unknown>),
        ...details,
      });
    }

    await goal.save();

    const { total } = await sumTaggedAmount(String(req.userId), goal.tag);
    const progress = buildListProgress(goal, total);

    res.json({
      success: true,
      data: {
        _id: goal._id,
        name: goal.name,
        tag: goal.tag,
        type: goal.type,
        icon: goal.icon,
        details: goal.details,
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
        progress,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteGoal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const goal = await Goal.findOneAndDelete({ _id: id, userId: req.userId });
    if (!goal) {
      throw new ApiError(404, 'Goal not found');
    }

    res.json({
      success: true,
      data: { id: goal._id },
    });
  } catch (error) {
    next(error);
  }
}

function defaultIcon(type: GoalType): string {
  if (type === 'loan') return 'landmark';
  if (type === 'sip') return 'trending-up';
  return 'target';
}

// Re-export for potential preview endpoints / tests
export { calculateEmi };
