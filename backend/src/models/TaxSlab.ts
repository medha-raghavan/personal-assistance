import mongoose, { Document, Schema } from 'mongoose';

export interface ITaxSlabEntry {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export interface ITaxSlab extends Document {
  _id: mongoose.Types.ObjectId;
  financialYear: string;
  regime: 'old' | 'new';
  slabs: ITaxSlabEntry[];
  standardDeduction: number;
  rebateLimit: number;
  rebateAmount: number;
  surchargeSlabs?: Array<{
    minIncome: number;
    maxIncome: number | null;
    rate: number;
  }>;
  cessRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const taxSlabSchema = new Schema<ITaxSlab>(
  {
    financialYear: {
      type: String,
      required: true,
    },
    regime: {
      type: String,
      enum: ['old', 'new'],
      required: true,
    },
    slabs: [{
      minAmount: { type: Number, required: true },
      maxAmount: { type: Number },
      rate: { type: Number, required: true },
    }],
    standardDeduction: {
      type: Number,
      default: 50000,
    },
    rebateLimit: {
      type: Number,
      default: 700000,
    },
    rebateAmount: {
      type: Number,
      default: 25000,
    },
    surchargeSlabs: [{
      minIncome: Number,
      maxIncome: Number,
      rate: Number,
    }],
    cessRate: {
      type: Number,
      default: 4,
    },
  },
  {
    timestamps: true,
  }
);

taxSlabSchema.index({ financialYear: 1, regime: 1 }, { unique: true });

export const TaxSlab = mongoose.model<ITaxSlab>('TaxSlab', taxSlabSchema);
