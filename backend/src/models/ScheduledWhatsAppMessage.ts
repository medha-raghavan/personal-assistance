import mongoose, { Document, Schema } from 'mongoose';

export type ScheduledMessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface IScheduledWhatsAppMessage extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  recipientPhone: string;
  recipientName?: string;
  message: string;
  scheduledAt: Date;
  status: ScheduledMessageStatus;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledWhatsAppMessageSchema = new Schema<IScheduledWhatsAppMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4096,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

scheduledWhatsAppMessageSchema.index({ status: 1, scheduledAt: 1 });
scheduledWhatsAppMessageSchema.index({ userId: 1, createdAt: -1 });

export const ScheduledWhatsAppMessage = mongoose.model<IScheduledWhatsAppMessage>(
  'ScheduledWhatsAppMessage',
  scheduledWhatsAppMessageSchema
);
