import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Section } from '../models/Section.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import { generateCompositeKey, extractKeywordsFromDescription } from '../utils/helpers.js';

export async function getTransactions(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      sectionId,
      categoryId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      type,
      tags,
      keyword,
      tripId,
      page = '1',
      limit = '50',
      sortBy = 'transactionDate',
      sortOrder = 'desc',
    } = req.query;

    const filter: Record<string, unknown> = { userId: req.userId };

    if (sectionId) {
      const sectionIds = (sectionId as string).split(',');
      filter.sectionId = { $in: sectionIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) (filter.transactionDate as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (filter.transactionDate as Record<string, Date>).$lte = new Date(endDate as string);
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) (filter.amount as Record<string, number>).$gte = parseFloat(minAmount as string);
      if (maxAmount) (filter.amount as Record<string, number>).$lte = parseFloat(maxAmount as string);
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (tags) {
      const tagList = (tags as string).split(',');
      filter.tags = { $in: tagList };
    }

    if (keyword) {
      filter.description = { $regex: keyword, $options: 'i' };
    }

    if (tripId) {
      filter.tripId = new mongoose.Types.ObjectId(tripId as string);
    }

    if (categoryId) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId as string);
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy as string]: sortDirection };

    const [transactions, totalCount, totalsResult] = await Promise.all([
      Transaction.find(filter)
        .populate('sectionId', 'name label type')
        .populate('tripId', 'name')
        .populate('categoryId', 'name color icon')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(filter),
      Transaction.aggregate([
        { $match: { ...filter, userId: new mongoose.Types.ObjectId(req.userId) } },
        {
          $group: {
            _id: null,
            totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            totalDebit: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const totals = totalsResult[0] || { totalCredit: 0, totalDebit: 0 };

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
        totals: {
          totalCredit: totals.totalCredit,
          totalDebit: totals.totalDebit,
          netTotal: totals.totalCredit - totals.totalDebit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createTransaction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      sectionId,
      transactionDate,
      valueDate,
      amount,
      type,
      description,
      reference,
      tags,
      categoryId,
      tripId,
      currency,
      exchangeRate,
    } = req.body;

    const section = await Section.findOne({ _id: sectionId, userId: req.userId });
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    const compositeKey = generateCompositeKey(
      transactionDate,
      amount,
      description,
      section.name
    );

    const existingTransaction = await Transaction.findOne({
      userId: req.userId,
      compositeKey,
    });

    if (existingTransaction) {
      throw new ApiError(400, 'Duplicate transaction detected');
    }

    const autoTags = tags?.length > 0 ? tags : extractKeywordsFromDescription(description);

    const transaction = new Transaction({
      sectionId,
      userId: req.userId,
      transactionDate: new Date(transactionDate),
      valueDate: valueDate ? new Date(valueDate) : undefined,
      amount,
      type,
      description,
      reference,
      tags: autoTags,
      categoryId: categoryId || undefined,
      tripId,
      currency: currency || 'INR',
      exchangeRate: exchangeRate || 1,
      compositeKey,
    });

    await transaction.save();

    if (type === 'credit') {
      section.balance += amount;
    } else {
      section.balance -= amount;
    }
    await section.save();

    res.status(201).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTransaction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { description, transactionDate, tags, categoryId, tripId, tripSplits, paidByMemberId, paidByMemberName } = req.body;

    const existingTransaction = await Transaction.findOne({ _id: id, userId: req.userId });
    if (!existingTransaction) {
      throw new ApiError(404, 'Transaction not found');
    }

    const updateSet: Record<string, unknown> = {};
    const updateUnset: Record<string, 1> = {};

    if (description !== undefined) updateSet.description = description;
    if (transactionDate !== undefined) updateSet.transactionDate = new Date(transactionDate);
    if (tags !== undefined) updateSet.tags = tags;
    
    if (categoryId !== undefined) {
      if (categoryId) {
        updateSet.categoryId = new mongoose.Types.ObjectId(categoryId);
      } else {
        updateUnset.categoryId = 1;
      }
    }
    
    if (tripId !== undefined) {
      if (tripId) {
        updateSet.tripId = new mongoose.Types.ObjectId(tripId);
      } else {
        updateUnset.tripId = 1;
        updateUnset.tripSplits = 1;
        updateUnset.paidByMemberId = 1;
        updateUnset.paidByMemberName = 1;
      }
    }
    
    if (tripSplits !== undefined && tripId) {
      if (tripSplits && tripSplits.length > 0) {
        updateSet.tripSplits = tripSplits.map((s: { memberId: string; memberName: string; amount: number }) => ({
          memberId: new mongoose.Types.ObjectId(s.memberId),
          memberName: s.memberName,
          amount: s.amount,
        }));
      } else {
        updateUnset.tripSplits = 1;
      }
    }
    
    if (paidByMemberId !== undefined && tripId) {
      if (paidByMemberId) {
        updateSet.paidByMemberId = new mongoose.Types.ObjectId(paidByMemberId);
      } else {
        updateUnset.paidByMemberId = 1;
      }
    }
    
    if (paidByMemberName !== undefined && tripId) {
      if (paidByMemberName) {
        updateSet.paidByMemberName = paidByMemberName;
      } else {
        updateUnset.paidByMemberName = 1;
      }
    }

    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(updateSet).length > 0) updateQuery.$set = updateSet;
    if (Object.keys(updateUnset).length > 0) updateQuery.$unset = updateUnset;

    const transaction = await Transaction.findByIdAndUpdate(
      id,
      updateQuery,
      { new: true }
    ).populate('categoryId', 'name color icon');

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTransaction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findOne({ _id: id, userId: req.userId });
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }

    const section = await Section.findById(transaction.sectionId);
    if (section) {
      if (transaction.type === 'credit') {
        section.balance -= transaction.amount;
      } else {
        section.balance += transaction.amount;
      }
      await section.save();
    }

    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdateTags(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { transactionIds, tags, action } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      throw new ApiError(400, 'Transaction IDs required');
    }

    if (!tags || !Array.isArray(tags)) {
      throw new ApiError(400, 'Tags array required');
    }

    let updateOperation;
    if (action === 'add') {
      updateOperation = { $addToSet: { tags: { $each: tags } } };
    } else if (action === 'remove') {
      updateOperation = { $pull: { tags: { $in: tags } } };
    } else {
      updateOperation = { $set: { tags } };
    }

    const result = await Transaction.updateMany(
      {
        _id: { $in: transactionIds },
        userId: req.userId,
      },
      updateOperation
    );

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { transactionIds, updates } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      throw new ApiError(400, 'Transaction IDs required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new ApiError(400, 'Updates object required');
    }

    const { transactionDate, categoryId, tags, tagAction } = updates;

    const updateSet: Record<string, unknown> = {};
    const updateUnset: Record<string, 1> = {};
    let tagOperation: Record<string, unknown> | null = null;

    if (transactionDate !== undefined) {
      updateSet.transactionDate = new Date(transactionDate);
    }

    if (categoryId !== undefined) {
      if (categoryId) {
        updateSet.categoryId = new mongoose.Types.ObjectId(categoryId);
      } else {
        updateUnset.categoryId = 1;
      }
    }

    if (tags !== undefined && Array.isArray(tags)) {
      if (tagAction === 'add') {
        tagOperation = { $addToSet: { tags: { $each: tags } } };
      } else if (tagAction === 'remove') {
        tagOperation = { $pull: { tags: { $in: tags } } };
      } else {
        updateSet.tags = tags;
      }
    }

    const updateQuery: Record<string, unknown> = {};
    if (Object.keys(updateSet).length > 0) updateQuery.$set = updateSet;
    if (Object.keys(updateUnset).length > 0) updateQuery.$unset = updateUnset;

    const filter = {
      _id: { $in: transactionIds.map(id => new mongoose.Types.ObjectId(id)) },
      userId: req.userId,
    };

    let modifiedCount = 0;

    if (Object.keys(updateQuery).length > 0) {
      const result = await Transaction.updateMany(filter, updateQuery);
      modifiedCount = result.modifiedCount;
    }

    if (tagOperation) {
      const tagResult = await Transaction.updateMany(filter, tagOperation);
      modifiedCount = Math.max(modifiedCount, tagResult.modifiedCount);
    }

    res.json({
      success: true,
      data: {
        modifiedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCalendarData(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { year, month } = req.params;

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const dailyData = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          transactionDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: '$transactionDate' },
          totalCredit: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] },
          },
          totalDebit: {
            $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        days: dailyData.map(d => ({
          day: d._id,
          credit: d.totalCredit,
          debit: d.totalDebit,
          net: d.totalCredit - d.totalDebit,
          count: d.transactionCount,
        })),
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
    const { startDate, endDate, groupBy = 'month' } = req.query;

    const matchStage: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.userId),
    };

    if (startDate || endDate) {
      matchStage.transactionDate = {};
      if (startDate) (matchStage.transactionDate as Record<string, Date>).$gte = new Date(startDate as string);
      if (endDate) (matchStage.transactionDate as Record<string, Date>).$lte = new Date(endDate as string);
    }

    let groupId;
    if (groupBy === 'day') {
      groupId = { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' } };
    } else if (groupBy === 'week') {
      groupId = { $dateToString: { format: '%Y-W%V', date: '$transactionDate' } };
    } else if (groupBy === 'year') {
      groupId = { $dateToString: { format: '%Y', date: '$transactionDate' } };
    } else {
      groupId = { $dateToString: { format: '%Y-%m', date: '$transactionDate' } };
    }

    const summary = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          totalCredit: {
            $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] },
          },
          totalDebit: {
            $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] },
          },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: summary.map(s => ({
        period: s._id,
        credit: s.totalCredit,
        debit: s.totalDebit,
        net: s.totalCredit - s.totalDebit,
        count: s.transactionCount,
      })),
    });
  } catch (error) {
    next(error);
  }
}
