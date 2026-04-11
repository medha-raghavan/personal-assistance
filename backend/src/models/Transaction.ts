import mongoose, { Document, Schema } from 'mongoose';

export interface ITransactionSplit {
  memberId: mongoose.Types.ObjectId;
  memberName: string;
  amount: number;
}

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  uploadSessionId?: mongoose.Types.ObjectId;
  tripSplits?: ITransactionSplit[];
  paidByMemberId?: mongoose.Types.ObjectId;
  paidByMemberName?: string;
  transactionDate: Date;
  valueDate?: Date;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  reference?: string;
  tags: string[];
  currency: string;
  exchangeRate: number;
  compositeKey: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    uploadSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'UploadSession',
      index: true,
    },
    tripSplits: [{
      memberId: { type: Schema.Types.ObjectId, required: true },
      memberName: { type: String, required: true },
      amount: { type: Number, required: true },
    }],
    paidByMemberId: {
      type: Schema.Types.ObjectId,
    },
    paidByMemberName: {
      type: String,
    },
    transactionDate: {
      type: Date,
      required: true,
      index: true,
    },
    valueDate: {
      type: Date,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    currency: {
      type: String,
      default: 'INR',
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    compositeKey: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ userId: 1, compositeKey: 1 }, { unique: true });
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, sectionId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, tags: 1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, categoryId: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
