import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Section } from '../models/Section.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

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
