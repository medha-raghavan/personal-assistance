import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip.js';
import { Transaction } from '../models/Transaction.js';
import { TripExpense } from '../models/TripExpense.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getTrips(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.query;
    
    const filter: Record<string, unknown> = { userId: req.userId };
    if (status) filter.status = status;
    
    const trips = await Trip.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: trips,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTrip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTrip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description, defaultCurrency, inrRate, startDate, endDate, members } = req.body;
    
    const trip = new Trip({
      userId: req.userId,
      name,
      description,
      defaultCurrency: defaultCurrency || 'INR',
      inrRate: inrRate || 1,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      members: members || [],
    });
    
    await trip.save();
    
    res.status(201).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTrip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, defaultCurrency, inrRate, startDate, endDate, status } = req.body;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    if (name !== undefined) trip.name = name;
    if (description !== undefined) trip.description = description;
    if (defaultCurrency !== undefined) trip.defaultCurrency = defaultCurrency;
    if (inrRate !== undefined) trip.inrRate = inrRate;
    if (startDate !== undefined) trip.startDate = new Date(startDate);
    if (endDate !== undefined) trip.endDate = new Date(endDate);
    if (status !== undefined) trip.status = status;
    
    await trip.save();
    
    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTrip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    await Transaction.updateMany(
      { tripId: id },
      { $unset: { tripId: 1 } }
    );
    
    await trip.deleteOne();
    
    res.json({
      success: true,
      message: 'Trip deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function addMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, splitPercentage, fixedAmount } = req.body;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    trip.members.push({
      name,
      email,
      isRegisteredUser: false,
      splitPercentage,
      fixedAmount,
    });
    
    await trip.save();
    
    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, memberId } = req.params;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    trip.members = trip.members.filter(m => m._id?.toString() !== memberId);
    await trip.save();
    
    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTripSummary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    const transactions = await Transaction.find({ tripId: id }).lean();
    
    const totalExpense = transactions.reduce((sum, t) => {
      if (t.type === 'debit') {
        return sum + (t.amount * t.exchangeRate);
      }
      return sum;
    }, 0);
    
    const memberCount = trip.members.length || 1;
    const equalShare = totalExpense / memberCount;
    
    const categoryBreakdown = transactions.reduce((acc, t) => {
      if (t.type === 'debit') {
        const category = t.tags[0] || 'Uncategorized';
        acc[category] = (acc[category] || 0) + t.amount;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const memberSplits = trip.members.map(member => {
      let share = equalShare;
      if (member.fixedAmount !== undefined) {
        share = member.fixedAmount;
      } else if (member.splitPercentage !== undefined) {
        share = (totalExpense * member.splitPercentage) / 100;
      }
      return {
        name: member.name,
        email: member.email,
        share,
        percentage: (share / totalExpense) * 100,
      };
    });
    
    res.json({
      success: true,
      data: {
        trip: {
          id: trip._id,
          name: trip.name,
          currency: trip.defaultCurrency,
          inrRate: trip.inrRate,
        },
        summary: {
          totalExpense,
          totalExpenseInINR: totalExpense * trip.inrRate,
          transactionCount: transactions.length,
          memberCount,
          equalShare,
        },
        categoryBreakdown,
        memberSplits,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function linkTransaction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, txnId } = req.params;
    
    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }
    
    const transaction = await Transaction.findOne({ _id: txnId, userId: req.userId });
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found');
    }
    
    transaction.tripId = new mongoose.Types.ObjectId(id);
    await transaction.save();
    
    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

export async function unlinkTransaction(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, txnId } = req.params;
    
    const transaction = await Transaction.findOne({
      _id: txnId,
      userId: req.userId,
      tripId: id,
    });
    
    if (!transaction) {
      throw new ApiError(404, 'Transaction not found or not linked to this trip');
    }
    
    transaction.tripId = undefined;
    await transaction.save();
    
    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
}

export async function addExpense(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const {
      description,
      amount,
      currency,
      exchangeRate,
      paidByMemberId,
      splitType,
      splits,
      selectedMemberIds,
      date,
      category,
    } = req.body;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const paidByMember = trip.members.find(m => m._id?.toString() === paidByMemberId);
    if (!paidByMember) {
      throw new ApiError(400, 'Paying member not found in trip');
    }

    const rate = exchangeRate || trip.inrRate || 1;
    const amountInINR = amount * rate;

    let calculatedSplits;
    if (splitType === 'equal') {
      const membersToSplit = selectedMemberIds && selectedMemberIds.length > 0
        ? trip.members.filter(m => selectedMemberIds.includes(m._id?.toString()))
        : trip.members;
      
      if (membersToSplit.length === 0) {
        throw new ApiError(400, 'At least one member must be selected for split');
      }
      
      const splitAmount = amount / membersToSplit.length;
      calculatedSplits = membersToSplit.map(m => ({
        memberId: m._id!,
        memberName: m.name,
        amount: splitAmount,
        isPaid: m._id?.toString() === paidByMemberId,
      }));
    } else if (splits && splits.length > 0) {
      calculatedSplits = splits.map((s: { memberId: string; amount: number }) => {
        const member = trip.members.find(m => m._id?.toString() === s.memberId);
        return {
          memberId: new mongoose.Types.ObjectId(s.memberId),
          memberName: member?.name || 'Unknown',
          amount: s.amount,
          isPaid: s.memberId === paidByMemberId,
        };
      });
    } else {
      throw new ApiError(400, 'Invalid splits');
    }

    const expense = new TripExpense({
      tripId: id,
      userId: req.userId,
      description,
      amount,
      currency: currency || trip.defaultCurrency,
      amountInINR,
      exchangeRate: rate,
      paidByMemberId,
      paidByMemberName: paidByMember.name,
      splitType: splitType || 'equal',
      splits: calculatedSplits,
      date: new Date(date),
      category,
    });

    await expense.save();

    res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
}

export async function getExpenses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const expenses = await TripExpense.find({ tripId: id }).sort({ date: -1 });

    res.json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateExpense(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, expenseId } = req.params;
    const {
      description,
      amount,
      currency,
      exchangeRate,
      paidByMemberId,
      splitType,
      splits,
      selectedMemberIds,
      date,
      category,
    } = req.body;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const expense = await TripExpense.findOne({
      _id: expenseId,
      tripId: id,
      userId: req.userId,
    });

    if (!expense) {
      throw new ApiError(404, 'Expense not found');
    }

    // Update fields if provided
    if (description !== undefined) expense.description = description;
    if (date !== undefined) expense.date = new Date(date);
    if (category !== undefined) expense.category = category;
    if (currency !== undefined) expense.currency = currency;

    // If amount or splits are being updated
    if (amount !== undefined) {
      expense.amount = amount;
      const rate = exchangeRate || expense.exchangeRate || trip.inrRate || 1;
      expense.amountInINR = amount * rate;
      expense.exchangeRate = rate;
    }

    // If payer is being updated
    if (paidByMemberId !== undefined) {
      const paidByMember = trip.members.find(m => m._id?.toString() === paidByMemberId);
      if (!paidByMember) {
        throw new ApiError(400, 'Paying member not found in trip');
      }
      expense.paidByMemberId = paidByMemberId;
      expense.paidByMemberName = paidByMember.name;
    }

    // If splits are being updated
    if (splitType !== undefined || splits !== undefined || selectedMemberIds !== undefined) {
      const currentAmount = amount !== undefined ? amount : expense.amount;
      const newSplitType = splitType || expense.splitType;

      let calculatedSplits;
      if (newSplitType === 'equal') {
        const membersToSplit = selectedMemberIds && selectedMemberIds.length > 0
          ? trip.members.filter(m => selectedMemberIds.includes(m._id?.toString()))
          : trip.members;
        
        if (membersToSplit.length === 0) {
          throw new ApiError(400, 'At least one member must be selected for split');
        }
        
        const splitAmount = currentAmount / membersToSplit.length;
        calculatedSplits = membersToSplit.map(m => ({
          memberId: m._id!,
          memberName: m.name,
          amount: splitAmount,
          isPaid: m._id?.toString() === (paidByMemberId || expense.paidByMemberId?.toString()),
        }));
      } else if (splits && splits.length > 0) {
        calculatedSplits = splits.map((s: { memberId: string; amount: number }) => {
          const member = trip.members.find(m => m._id?.toString() === s.memberId);
          return {
            memberId: new mongoose.Types.ObjectId(s.memberId),
            memberName: member?.name || 'Unknown',
            amount: s.amount,
            isPaid: s.memberId === (paidByMemberId || expense.paidByMemberId?.toString()),
          };
        });
      }

      if (calculatedSplits) {
        expense.splitType = newSplitType;
        expense.splits = calculatedSplits;
      }
    }

    await expense.save();

    res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteExpense(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, expenseId } = req.params;

    const expense = await TripExpense.findOne({
      _id: expenseId,
      tripId: id,
      userId: req.userId,
    });

    if (!expense) {
      throw new ApiError(404, 'Expense not found');
    }

    await expense.deleteOne();

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getBalances(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const expenses = await TripExpense.find({ tripId: id });
    const linkedTransactions = await Transaction.find({ tripId: id, userId: req.userId });

    const memberBalances: Record<string, { name: string; paid: number; owes: number; totalShare: number; balance: number }> = {};
    
    trip.members.forEach(member => {
      memberBalances[member._id!.toString()] = {
        name: member.name,
        paid: 0,
        owes: 0,        // What this person owes to OTHER people
        totalShare: 0,  // Total fair share across all expenses (for balance calc)
        balance: 0,
      };
    });

    expenses.forEach(expense => {
      const payerId = expense.paidByMemberId.toString();
      if (memberBalances[payerId]) {
        memberBalances[payerId].paid += expense.amount;
      }

      expense.splits.forEach(split => {
        const memberId = split.memberId.toString();
        if (memberBalances[memberId]) {
          // Track total share for balance calculation
          memberBalances[memberId].totalShare += split.amount;
          
          // Only add to "owes" if this person didn't pay for this expense
          // (you don't owe yourself - only track what you owe to others)
          if (memberId !== payerId) {
            memberBalances[memberId].owes += split.amount;
          }
        }
      });
    });

    linkedTransactions.forEach(txn => {
      if (txn.tripSplits && txn.tripSplits.length > 0) {
        const payerId = txn.paidByMemberId?.toString();
        if (payerId && memberBalances[payerId]) {
          memberBalances[payerId].paid += txn.amount;
        }

        txn.tripSplits.forEach(split => {
          const memberId = split.memberId.toString();
          if (memberBalances[memberId]) {
            // Track total share for balance calculation
            memberBalances[memberId].totalShare += split.amount;
            
            // Only add to "owes" if this person didn't pay for this transaction
            // (you don't owe yourself - only track what you owe to others)
            if (memberId !== payerId) {
              memberBalances[memberId].owes += split.amount;
            }
          }
        });
      }
    });

    // Balance = what you paid - your total fair share
    // Positive = others owe you, Negative = you owe others
    Object.keys(memberBalances).forEach(memberId => {
      memberBalances[memberId].balance = 
        memberBalances[memberId].paid - memberBalances[memberId].totalShare;
    });

    const settlements = calculateSettlements(memberBalances);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalLinkedTransactions = linkedTransactions
      .filter(t => t.tripSplits && t.tripSplits.length > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      data: {
        trip: {
          id: trip._id,
          name: trip.name,
          currency: trip.defaultCurrency,
        },
        totalExpenses: totalExpenses + totalLinkedTransactions,
        expenseCount: expenses.length,
        linkedTransactionCount: linkedTransactions.filter(t => t.tripSplits && t.tripSplits.length > 0).length,
        memberBalances: Object.entries(memberBalances).map(([id, data]) => ({
          memberId: id,
          ...data,
        })),
        settlements,
      },
    });
  } catch (error) {
    next(error);
  }
}

function calculateSettlements(
  balances: Record<string, { name: string; paid: number; owes: number; balance: number }>
): Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> {
  const settlements: Array<{ from: string; fromName: string; to: string; toName: string; amount: number }> = [];
  
  const debtors: Array<{ id: string; name: string; amount: number }> = [];
  const creditors: Array<{ id: string; name: string; amount: number }> = [];

  Object.entries(balances).forEach(([id, data]) => {
    if (data.balance < -0.01) {
      debtors.push({ id, name: data.name, amount: Math.abs(data.balance) });
    } else if (data.balance > 0.01) {
      creditors.push({ id, name: data.name, amount: data.balance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(debtor.amount, creditor.amount);
    
    if (amount > 0.01) {
      settlements.push({
        from: debtor.id,
        fromName: debtor.name,
        to: creditor.id,
        toName: creditor.name,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return settlements;
}

export async function updateMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id, memberId } = req.params;
    const { name, email } = req.body;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const member = trip.members.find(m => m._id?.toString() === memberId);
    if (!member) {
      throw new ApiError(404, 'Member not found');
    }

    if (name) member.name = name;
    if (email !== undefined) member.email = email;

    await trip.save();

    res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLinkedTransactions(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const trip = await Trip.findOne({ _id: id, userId: req.userId });
    if (!trip) {
      throw new ApiError(404, 'Trip not found');
    }

    const transactions = await Transaction.find({ tripId: id, userId: req.userId })
      .populate('sectionId', 'name')
      .populate('categoryId', 'name color icon')
      .sort({ transactionDate: -1 });

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
}
