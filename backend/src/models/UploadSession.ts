import mongoose, { Document, Schema } from 'mongoose';

export interface IParsedTransaction {
  transactionDate: Date;
  valueDate?: Date;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  reference?: string;
  tags: string[];
  categoryId?: string;
  categoryName?: string;
  compositeKey: string;
  isDuplicate: boolean;
  balance?: number;
}

export interface IUploadSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sectionId: mongoose.Types.ObjectId;
  fileName: string;
  filePath: string;
  fileType: string;
  status: 'pending' | 'previewing' | 'confirmed' | 'failed' | 'expired';
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  errorMessage?: string;
  parsedDataPath?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const uploadSessionSchema = new Schema<IUploadSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'previewing', 'confirmed', 'failed', 'expired'],
      default: 'pending',
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    duplicateCount: {
      type: Number,
      default: 0,
    },
    newCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
    parsedDataPath: {
      type: String,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export const UploadSession = mongoose.model<IUploadSession>('UploadSession', uploadSessionSchema);
