import mongoose, { Document, Schema } from 'mongoose';

export interface IInvestment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  category: '80C' | '80D' | '80CCD' | 'NPS' | '80G' | 'HRA' | 'LTA' | 'OTHER';
  subCategory?: string;
  name: string;
  description?: string;
  amount: number;
  financialYear: string;
  startDate?: Date;
  maturityDate?: Date;
  status: 'active' | 'matured' | 'cancelled';
  proofDocument?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const investmentSchema = new Schema<IInvestment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['80C', '80D', '80CCD', 'NPS', '80G', 'HRA', 'LTA', 'OTHER'],
      required: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    financialYear: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
    },
    maturityDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'matured', 'cancelled'],
      default: 'active',
    },
    proofDocument: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

investmentSchema.index({ userId: 1, financialYear: 1, category: 1 });

export const Investment = mongoose.model<IInvestment>('Investment', investmentSchema);
