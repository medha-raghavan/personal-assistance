import mongoose, { Document, Schema } from 'mongoose';

export interface ISalarySlip extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  financialYear: string;
  month?: string;
  grossIncome: number;
  basicSalary?: number;
  hra?: number;
  specialAllowance?: number;
  otherAllowances?: number;
  deductions: {
    pf?: number;
    professionalTax?: number;
    incomeTax?: number;
    other?: number;
  };
  netSalary: number;
  uploadDate: Date;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const salarySlipSchema = new Schema<ISalarySlip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
    },
    month: {
      type: String,
    },
    grossIncome: {
      type: Number,
      required: true,
    },
    basicSalary: {
      type: Number,
    },
    hra: {
      type: Number,
    },
    specialAllowance: {
      type: Number,
    },
    otherAllowances: {
      type: Number,
    },
    deductions: {
      pf: Number,
      professionalTax: Number,
      incomeTax: Number,
      other: Number,
    },
    netSalary: {
      type: Number,
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    sourceFile: {
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

salarySlipSchema.index({ userId: 1, financialYear: 1 });

export const SalarySlip = mongoose.model<ISalarySlip>('SalarySlip', salarySlipSchema);
