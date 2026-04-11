import mongoose, { Document, Schema } from 'mongoose';

export interface IExpenseSplit {
  memberId: mongoose.Types.ObjectId;
  memberName: string;
  amount: number;
  isPaid: boolean;
}

export interface ITripExpense extends Document {
  _id: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  currency: string;
  amountInINR: number;
  exchangeRate: number;
  paidByMemberId: mongoose.Types.ObjectId;
  paidByMemberName: string;
  splitType: 'equal' | 'percentage' | 'exact' | 'shares';
  splits: IExpenseSplit[];
  transactionId?: mongoose.Types.ObjectId;
  date: Date;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSplitSchema = new Schema<IExpenseSplit>(
  {
    memberId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    memberName: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const tripExpenseSchema = new Schema<ITripExpense>(
  {
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    amountInINR: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    paidByMemberId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    paidByMemberName: {
      type: String,
      required: true,
    },
    splitType: {
      type: String,
      enum: ['equal', 'percentage', 'exact', 'shares'],
      default: 'equal',
    },
    splits: [expenseSplitSchema],
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

tripExpenseSchema.index({ tripId: 1, date: -1 });

export const TripExpense = mongoose.model<ITripExpense>('TripExpense', tripExpenseSchema);
