import { Response, NextFunction } from 'express';
import { Section } from '../models/Section.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getSections(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sections = await Section.find({ userId: req.userId }).sort({ name: 1 });
    
    res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    next(error);
  }
}

export async function createSection(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, label, type, balance, uploadEnabled, parserConfig } = req.body;
    
    const existingSection = await Section.findOne({ userId: req.userId, name });
    if (existingSection) {
      throw new ApiError(400, 'Section with this name already exists');
    }
    
    const section = new Section({
      userId: req.userId,
      name,
      label: label || name,
      type: type || 'debit',
      balance: balance || 0,
      uploadEnabled: uploadEnabled !== false,
      parserConfig: parserConfig || { type: 'manual' },
    });
    
    await section.save();
    
    res.status(201).json({
      success: true,
      data: section,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSection(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, label, type, balance, uploadEnabled, parserConfig } = req.body;
    
    const section = await Section.findOne({ _id: id, userId: req.userId });
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }
    
    if (name && name !== section.name) {
      const existingSection = await Section.findOne({ userId: req.userId, name });
      if (existingSection) {
        throw new ApiError(400, 'Section with this name already exists');
      }
      section.name = name;
    }
    
    if (label !== undefined) section.label = label;
    if (type !== undefined) section.type = type;
    if (balance !== undefined) section.balance = balance;
    if (uploadEnabled !== undefined) section.uploadEnabled = uploadEnabled;
    if (parserConfig !== undefined) section.parserConfig = parserConfig;
    
    await section.save();
    
    res.json({
      success: true,
      data: section,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSection(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const section = await Section.findOne({ _id: id, userId: req.userId });
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }
    
    const transactionCount = await Transaction.countDocuments({ sectionId: id });
    if (transactionCount > 0) {
      throw new ApiError(400, `Cannot delete section with ${transactionCount} transactions. Delete transactions first.`);
    }
    
    await section.deleteOne();
    
    res.json({
      success: true,
      message: 'Section deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getSectionBalance(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const section = await Section.findOne({ _id: id, userId: req.userId });
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }
    
    const aggregation = await Transaction.aggregate([
      { $match: { sectionId: section._id, userId: section.userId } },
      {
        $group: {
          _id: null,
          totalCredit: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] },
          },
          totalDebit: {
            $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
    ]);
    
    const result = aggregation[0] || { totalCredit: 0, totalDebit: 0, transactionCount: 0 };
    
    res.json({
      success: true,
      data: {
        section: section.name,
        storedBalance: section.balance,
        calculatedBalance: result.totalCredit - result.totalDebit,
        totalCredit: result.totalCredit,
        totalDebit: result.totalDebit,
        transactionCount: result.transactionCount,
      },
    });
  } catch (error) {
    next(error);
  }
}
