import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Section } from '../models/Section.js';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { AuthRequest } from '../middleware/auth.js';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const UNCATEGORIZED_COLOR = '#8B93A3';

type MatchFilter = Record<string, unknown>;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseLocalDate(value: unknown, end = false): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const d = dayOnly
    ? new Date(`${raw}T${end ? '23:59:59.999' : '00:00:00'}`)
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (!dayOnly) {
    if (end) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
  }
  return d;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function padMonth(month: number): string {
  return String(month).padStart(2, '0');
}

function resolvePeriod(
  periodRaw: unknown,
  startDate?: unknown,
  endDate?: unknown
): { range: { $gte?: Date; $lte?: Date } | null; periodLabel: string; period: string } {
  const period = typeof periodRaw === 'string' && periodRaw ? periodRaw : '30';
  const now = new Date();
  const todayEnd = endOfDay(now);
  const rolling: Record<string, string> = {
    '7': 'last 7 days',
    '30': 'last 30 days',
    '90': 'last 90 days',
  };

  if (period === '7' || period === '30' || period === '90') {
    const days = parseInt(period, 10);
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
    return { range: { $gte: start, $lte: todayEnd }, periodLabel: rolling[period], period };
  }

  if (period === '365') {
    const start = new Date(now.getFullYear(), 0, 1);
    start.setHours(0, 0, 0, 0);
    return { range: { $gte: start, $lte: todayEnd }, periodLabel: 'this year', period };
  }

  if (period === 'all') {
    return { range: null, periodLabel: 'all time', period };
  }

  if (period === 'custom') {
    const from = parseLocalDate(startDate, false);
    const to = parseLocalDate(endDate, true);
    if (!from && !to) {
      return { range: null, periodLabel: 'custom range', period };
    }
    const range: { $gte?: Date; $lte?: Date } = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    return {
      range,
      periodLabel: `${from ? formatShortDate(from) : '…'} – ${to ? formatShortDate(to) : '…'}`,
      period,
    };
  }

  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
  return { range: { $gte: start, $lte: todayEnd }, periodLabel: 'last 30 days', period: '30' };
}

function parseCategoryIds(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => mongoose.isValidObjectId(id));
}

function parseType(raw: unknown): 'all' | 'credit' | 'debit' {
  if (raw === 'credit' || raw === 'debit') return raw;
  return 'all';
}

function buildMatch(
  userId: string,
  opts: {
    range: { $gte?: Date; $lte?: Date } | null;
    sectionId?: string;
    type?: 'all' | 'credit' | 'debit';
    categoryIds: string[];
    ignorePeriod?: boolean;
    ignoreAccount?: boolean;
    ignoreType?: boolean;
  }
): MatchFilter {
  const match: MatchFilter = {
    userId: new mongoose.Types.ObjectId(userId),
  };

  if (!opts.ignorePeriod && opts.range) {
    match.transactionDate = opts.range;
  }

  if (!opts.ignoreAccount && opts.sectionId && mongoose.isValidObjectId(opts.sectionId)) {
    match.sectionId = new mongoose.Types.ObjectId(opts.sectionId);
  }

  if (!opts.ignoreType && opts.type && opts.type !== 'all') {
    match.type = opts.type;
  }

  if (opts.categoryIds.length > 0) {
    match.categoryId = {
      $in: opts.categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  return match;
}

function mongoDayOfWeekToMonIndex(dayOfWeek: number): number {
  // Mongo $dayOfWeek: 1 = Sunday … 7 = Saturday → Mon=0 … Sun=6
  return dayOfWeek === 1 ? 6 : dayOfWeek - 2;
}

export async function getOverview(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sections = await Section.find({ userId: req.userId });

    const totalBalance = sections.reduce((sum, s) => {
      if (s.type === 'credit') {
        return sum - s.balance;
      }
      return sum + s.balance;
    }, 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthStats, lastMonthStats] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            transactionDate: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(req.userId),
            transactionDate: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const currentMonth = thisMonthStats[0] || { income: 0, expense: 0, count: 0 };
    const lastMonth = lastMonthStats[0] || { income: 0, expense: 0 };

    const savingsRate = currentMonth.income > 0
      ? ((currentMonth.income - currentMonth.expense) / currentMonth.income) * 100
      : 0;

    const expenseChange = lastMonth.expense > 0
      ? ((currentMonth.expense - lastMonth.expense) / lastMonth.expense) * 100
      : 0;

    const recentTransactions = await Transaction.find({ userId: req.userId })
      .populate('sectionId', 'name label type')
      .populate('categoryId', 'name color icon')
      .sort({ transactionDate: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        totalBalance,
        sections: sections.map(s => ({
          id: s._id,
          name: s.name,
          label: s.label,
          type: s.type,
          balance: s.balance,
        })),
        thisMonth: {
          income: currentMonth.income,
          expense: currentMonth.expense,
          net: currentMonth.income - currentMonth.expense,
          transactionCount: currentMonth.count,
          savingsRate: Math.round(savingsRate * 10) / 10,
        },
        comparison: {
          expenseChange: Math.round(expenseChange * 10) / 10,
          lastMonthExpense: lastMonth.expense,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrends(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { months = '6' } = req.query;
    const monthCount = parseInt(months as string, 10);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthCount);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const trends = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          transactionDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' },
          },
          income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const formattedTrends = trends.map(t => ({
      period: `${t._id.year}-${String(t._id.month).padStart(2, '0')}`,
      income: t.income,
      expense: t.expense,
      net: t.income - t.expense,
      count: t.count,
    }));

    res.json({
      success: true,
      data: formattedTrends,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCategoryBreakdown(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { startDate, endDate } = req.query;

    const matchStage: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.userId),
      type: 'debit',
    };

    if (startDate || endDate) {
      matchStage.transactionDate = {};
      if (startDate) (matchStage.transactionDate as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (matchStage.transactionDate as Record<string, Date>).$lte = new Date(endDate as string);
    } else {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      matchStage.transactionDate = { $gte: startOfMonth };
    }

    const breakdown = await Transaction.aggregate([
      { $match: matchStage },
      { $unwind: { path: '$tags', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$tags', 'Uncategorized'] },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const totalExpense = breakdown.reduce((sum, b) => sum + b.total, 0);

    const categories = breakdown.map(b => ({
      category: b._id,
      amount: b.total,
      count: b.count,
      percentage: totalExpense > 0 ? Math.round((b.total / totalExpense) * 1000) / 10 : 0,
    }));

    res.json({
      success: true,
      data: {
        totalExpense,
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarHeatmap(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year as string, 10) : new Date().getFullYear();

    const startDate = new Date(targetYear, 0, 1);
    const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

    const dailyData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const maxExpense = Math.max(...dailyData.map(d => d.expense), 1);

    const heatmapData = dailyData.map(d => ({
      date: d._id,
      expense: d.expense,
      income: d.income,
      count: d.count,
      intensity: Math.min(Math.round((d.expense / maxExpense) * 4), 4),
    }));

    res.json({
      success: true,
      data: {
        year: targetYear,
        days: heatmapData,
        maxExpense,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSummary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId as string;
    const { period: periodRaw, startDate, endDate, sectionId: sectionIdRaw, type: typeRaw, categoryIds: categoryIdsRaw } = req.query;

    const { range, periodLabel } = resolvePeriod(periodRaw, startDate, endDate);
    const type = parseType(typeRaw);
    const categoryIds = parseCategoryIds(categoryIdsRaw);
    const sectionId = typeof sectionIdRaw === 'string' && mongoose.isValidObjectId(sectionIdRaw)
      ? sectionIdRaw
      : undefined;

    const filterOpts = { range, sectionId, type, categoryIds };
    const match = buildMatch(userId, filterOpts);
    const matchIgnoreAccount = buildMatch(userId, { ...filterOpts, ignoreAccount: true });
    const matchIgnoreType = buildMatch(userId, { ...filterOpts, ignoreType: true });

    const breakdownType: 'credit' | 'debit' = type === 'credit' ? 'credit' : 'debit';
    const categoryMatch: MatchFilter = { ...matchIgnoreType, type: breakdownType };

    const now = new Date();
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    trendStart.setHours(0, 0, 0, 0);
    const trendMatch: MatchFilter = {
      userId: new mongoose.Types.ObjectId(userId),
      transactionDate: { $gte: trendStart },
    };
    if (sectionId) {
      trendMatch.sectionId = new mongoose.Types.ObjectId(sectionId);
    }

    const dowMatch: MatchFilter | null = type === 'credit' ? null : { ...match, type: 'debit' };
    const accountCatMatch: MatchFilter | null = type === 'credit'
      ? null
      : { ...matchIgnoreAccount, type: 'debit' };
    const topExpenseMatch: MatchFilter = { ...matchIgnoreType, type: 'debit' };
    const topIncomeMatch: MatchFilter = { ...matchIgnoreType, type: 'credit' };

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const [
      sections,
      categories,
      heroRows,
      dowRows,
      categoryRows,
      trendRows,
      accountStatRows,
      accountCatRows,
      topExpenseDocs,
      topIncomeDocs,
    ] = await Promise.all([
      Section.find({ userId: userObjectId }).lean(),
      Category.find({ userId: userObjectId }).sort({ name: 1 }).lean(),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
            incomeCount: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, 1, 0] } },
            expenseCount: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, 1, 0] } },
          },
        },
      ]),
      dowMatch
        ? Transaction.aggregate([
            { $match: dowMatch },
            {
              $group: {
                _id: { $dayOfWeek: '$transactionDate' },
                amount: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([] as Array<{ _id: number; amount: number; count: number }>),
      Transaction.aggregate([
        { $match: categoryMatch },
        {
          $group: {
            _id: '$categoryId',
            amount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { amount: -1 } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      ]),
      Transaction.aggregate([
        { $match: trendMatch },
        {
          $group: {
            _id: {
              year: { $year: '$transactionDate' },
              month: { $month: '$transactionDate' },
            },
            income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: matchIgnoreAccount },
        {
          $group: {
            _id: '$sectionId',
            income: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          },
        },
      ]),
      accountCatMatch
        ? Transaction.aggregate([
            { $match: accountCatMatch },
            {
              $group: {
                _id: { sectionId: '$sectionId', categoryId: '$categoryId' },
                amount: { $sum: '$amount' },
              },
            },
            { $sort: { amount: -1 } },
            {
              $group: {
                _id: '$_id.sectionId',
                cats: {
                  $push: { categoryId: '$_id.categoryId', amount: '$amount' },
                },
              },
            },
            { $project: { cats: { $slice: ['$cats', 3] } } },
          ])
        : Promise.resolve([] as Array<{ _id: mongoose.Types.ObjectId; cats: Array<{ categoryId?: mongoose.Types.ObjectId; amount: number }> }>),
      Transaction.find(topExpenseMatch)
        .populate('sectionId', 'name label')
        .populate('categoryId', 'name')
        .sort({ amount: -1 })
        .limit(10)
        .lean(),
      Transaction.find(topIncomeMatch)
        .populate('sectionId', 'name label')
        .populate('categoryId', 'name')
        .sort({ amount: -1 })
        .limit(10)
        .lean(),
    ]);

    const selectedSection = sectionId
      ? sections.find((s) => s._id.toString() === sectionId)
      : undefined;

    const totalBalance = selectedSection
      ? selectedSection.balance
      : sections.reduce((sum, s) => (s.type === 'credit' ? sum - s.balance : sum + s.balance), 0);

    const hero = heroRows[0] || { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    const net = hero.income - hero.expense;
    const savingsRate = hero.income > 0
      ? Math.round(((net / hero.income) * 100) * 10) / 10
      : 0;

    const accounts = sections.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      label: s.label,
      type: s.type,
      balance: s.balance,
    }));

    const categoryOptions = categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      icon: c.icon,
      color: c.color,
    }));

    const catById = new Map(categories.map((c) => [c._id.toString(), c]));

    const subtitleBits = [
      selectedSection ? selectedSection.name : `${sections.length} account${sections.length === 1 ? '' : 's'}`,
      periodLabel,
    ];
    if (type === 'credit') subtitleBits.push('income only');
    if (type === 'debit') subtitleBits.push('expense only');
    if (categoryIds.length) {
      subtitleBits.push(`${categoryIds.length} categor${categoryIds.length === 1 ? 'y' : 'ies'} selected`);
    }

    const dowByIndex = new Array(7).fill(null).map(() => ({ amount: 0, count: 0 }));
    for (const row of dowRows) {
      const idx = mongoDayOfWeekToMonIndex(row._id as number);
      if (idx >= 0 && idx < 7) {
        dowByIndex[idx] = { amount: row.amount, count: row.count };
      }
    }
    const dowDays = DOW_LABELS.map((label, i) => ({
      label,
      amount: dowByIndex[i].amount,
      count: dowByIndex[i].count,
      isWeekend: i >= 5,
    }));

    const hasDowData = dowDays.some((d) => d.count > 0);
    let dayOfWeekInsight: {
      peakDay: string;
      peakAmount: number;
      troughDay: string;
      weekendsHigher: boolean;
      skewPercent: number;
    } | null = null;

    if (hasDowData) {
      const totals = dowDays.map((d) => d.amount);
      const peakIdx = totals.indexOf(Math.max(...totals));
      const troughDay = dowDays
        .filter((d) => d.count > 0)
        .reduce((min, d) => (d.amount < min.amount ? d : min));
      const weekdayTotal = totals.slice(0, 5).reduce((a, b) => a + b, 0);
      const weekendTotal = totals.slice(5).reduce((a, b) => a + b, 0);
      const weekdayAvg = weekdayTotal / 5;
      const weekendAvg = weekendTotal / 2;
      const weekendsHigher = weekendAvg > weekdayAvg;
      let skewPercent = 0;
      if (weekdayAvg === 0 && weekendAvg === 0) {
        skewPercent = 0;
      } else if (weekdayAvg === 0 || weekendAvg === 0) {
        skewPercent = 100;
      } else {
        skewPercent = weekendsHigher
          ? Math.round((weekendAvg / weekdayAvg - 1) * 100)
          : Math.round((weekdayAvg / weekendAvg - 1) * 100);
      }
      dayOfWeekInsight = {
        peakDay: DOW_LABELS[peakIdx],
        peakAmount: totals[peakIdx],
        troughDay: troughDay.label,
        weekendsHigher,
        skewPercent,
      };
    }

    const categoryTotal = categoryRows.reduce((sum, row) => sum + row.amount, 0);
    const categoryItems = categoryRows.map((row) => {
      const name = row.category?.name || 'Uncategorized';
      const color = row.category?.color || UNCATEGORIZED_COLOR;
      const icon = row.category?.icon;
      const id = row._id ? String(row._id) : null;
      return {
        id,
        name,
        icon,
        color,
        amount: row.amount,
        percentage: categoryTotal > 0 ? Math.round((row.amount / categoryTotal) * 100) : 0,
      };
    });

    const trendByPeriod = new Map(
      trendRows.map((t) => [
        `${t._id.year}-${padMonth(t._id.month)}`,
        { income: t.income as number, expense: t.expense as number },
      ])
    );
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodKey = `${d.getFullYear()}-${padMonth(d.getMonth() + 1)}`;
      const row = trendByPeriod.get(periodKey);
      monthlyTrend.push({
        period: periodKey,
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
        income: row?.income ?? 0,
        expense: row?.expense ?? 0,
      });
    }

    const statsBySection = new Map(
      accountStatRows.map((r) => [String(r._id), { income: r.income as number, expense: r.expense as number }])
    );
    const catsBySection = new Map(
      accountCatRows.map((r) => [String(r._id), r.cats as Array<{ categoryId?: mongoose.Types.ObjectId; amount: number }>])
    );

    const accountBreakdown = sections.map((s) => {
      const id = s._id.toString();
      const stats = statsBySection.get(id) || { income: 0, expense: 0 };
      const top = (catsBySection.get(id) || []).map((c) => ({
        name: c.categoryId ? (catById.get(String(c.categoryId))?.name || 'Uncategorized') : 'Uncategorized',
        amount: c.amount,
      }));
      return {
        id,
        name: s.name,
        label: s.label,
        balance: s.balance,
        dimmed: Boolean(sectionId) && id !== sectionId,
        income: stats.income,
        expense: stats.expense,
        topCategories: top,
      };
    });

    const mapTopTx = (t: typeof topExpenseDocs[number]) => {
      const section = t.sectionId as unknown as { name?: string; label?: string } | null;
      const category = t.categoryId as unknown as { name?: string } | null;
      return {
        id: t._id.toString(),
        date: t.transactionDate,
        description: t.description,
        tags: t.tags || [],
        categoryName: category?.name || 'Uncategorized',
        accountName: section?.name || section?.label || 'Unknown',
        amount: t.amount,
        type: t.type,
      };
    };
    const topTransactions = {
      expense: topExpenseDocs.map(mapTopTx),
      income: topIncomeDocs.map(mapTopTx),
    };

    res.json({
      success: true,
      data: {
        meta: {
          accountCount: sections.length,
          periodLabel,
          subtitle: subtitleBits.join(' · '),
        },
        accounts,
        categories: categoryOptions,
        hero: {
          totalBalance,
          income: hero.income,
          expense: hero.expense,
          net,
          savingsRate,
          incomeCount: hero.incomeCount,
          expenseCount: hero.expenseCount,
        },
        dayOfWeek: {
          days: dowDays,
          insight: dayOfWeekInsight,
        },
        categoryBreakdown: {
          mode: breakdownType === 'credit' ? 'income' : 'expense',
          total: categoryTotal,
          items: categoryItems,
        },
        monthlyTrend,
        accountBreakdown,
        topTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
}
