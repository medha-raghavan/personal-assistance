import { Response, NextFunction } from 'express';
import { Investment } from '../models/Investment.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import { getFinancialYear } from '../utils/helpers.js';

const DEDUCTION_LIMITS: Record<string, number> = {
  '80C': 150000,
  '80D': 25000,
  '80CCD': 50000,
  'NPS': 50000,
  '80G': Infinity,
  'HRA': Infinity,
  'LTA': Infinity,
  'OTHER': Infinity,
};

export async function getInvestments(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fy, category, status } = req.query;
    
    const filter: Record<string, unknown> = { userId: req.userId };
    if (fy) filter.financialYear = fy;
    if (category) filter.category = category;
    if (status) filter.status = status;
    
    const investments = await Investment.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: investments,
    });
  } catch (error) {
    next(error);
  }
}

export async function createInvestment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      category,
      subCategory,
      name,
      description,
      amount,
      financialYear,
      startDate,
      maturityDate,
    } = req.body;

    const investment = new Investment({
      userId: req.userId,
      category,
      subCategory,
      name,
      description,
      amount,
      financialYear: financialYear || getFinancialYear(new Date()),
      startDate: startDate ? new Date(startDate) : undefined,
      maturityDate: maturityDate ? new Date(maturityDate) : undefined,
    });

    await investment.save();

    res.status(201).json({
      success: true,
      data: investment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateInvestment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, amount, status, maturityDate } = req.body;

    const investment = await Investment.findOne({ _id: id, userId: req.userId });
    if (!investment) {
      throw new ApiError(404, 'Investment not found');
    }

    if (name !== undefined) investment.name = name;
    if (description !== undefined) investment.description = description;
    if (amount !== undefined) investment.amount = amount;
    if (status !== undefined) investment.status = status;
    if (maturityDate !== undefined) investment.maturityDate = new Date(maturityDate);

    await investment.save();

    res.json({
      success: true,
      data: investment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteInvestment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const investment = await Investment.findOne({ _id: id, userId: req.userId });
    if (!investment) {
      throw new ApiError(404, 'Investment not found');
    }

    await investment.deleteOne();

    res.json({
      success: true,
      message: 'Investment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvestmentSummary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fy } = req.params;

    const investments = await Investment.find({
      userId: req.userId,
      financialYear: fy,
      status: 'active',
    });

    const categoryTotals = investments.reduce((acc, inv) => {
      if (!acc[inv.category]) {
        acc[inv.category] = {
          total: 0,
          limit: DEDUCTION_LIMITS[inv.category] || Infinity,
          investments: [],
        };
      }
      acc[inv.category].total += inv.amount;
      acc[inv.category].investments.push({
        id: inv._id,
        name: inv.name,
        amount: inv.amount,
        subCategory: inv.subCategory,
      });
      return acc;
    }, {} as Record<string, { total: number; limit: number; investments: Array<{ id: unknown; name: string; amount: number; subCategory?: string }> }>);

    const summary = Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      total: data.total,
      limit: data.limit,
      utilized: Math.min(data.total, data.limit),
      remaining: Math.max(0, data.limit - data.total),
      utilizationPercent: data.limit === Infinity ? 0 : (Math.min(data.total, data.limit) / data.limit) * 100,
      investments: data.investments,
    }));

    const totalDeductions = summary.reduce((sum, cat) => sum + cat.utilized, 0);

    res.json({
      success: true,
      data: {
        financialYear: fy,
        totalDeductions,
        categories: summary,
      },
    });
  } catch (error) {
    next(error);
  }
}
