import mongoose, { Document, Schema } from 'mongoose';

export interface ISection extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  label: string;
  type: 'cash' | 'checking' | 'credit' | 'savings' | 'investment' | 'digital_wallet';
  balance: number;
  uploadEnabled: boolean;
  parserConfig: {
    type: 'auto' | 'hdfc_csv' | 'hdfc_xls' | 'icici_pdf' | 'generic_xls' | 'manual';
    columnMapping?: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['cash', 'checking', 'credit', 'savings', 'investment', 'digital_wallet', 'debit'],
      default: 'checking',
    },
    balance: {
      type: Number,
      default: 0,
    },
    uploadEnabled: {
      type: Boolean,
      default: true,
    },
    parserConfig: {
      type: {
        type: String,
        enum: ['auto', 'hdfc_csv', 'hdfc_xls', 'icici_pdf', 'generic_xls', 'manual'],
        default: 'auto',
      },
      columnMapping: {
        type: Map,
        of: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

sectionSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Section = mongoose.model<ISection>('Section', sectionSchema);
