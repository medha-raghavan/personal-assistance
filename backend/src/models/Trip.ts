import mongoose, { Document, Schema } from 'mongoose';

export interface ITripMember {
  _id?: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  isRegisteredUser: boolean;
  userId?: mongoose.Types.ObjectId;
  splitPercentage?: number;
  fixedAmount?: number;
}

export interface ITrip extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  defaultCurrency: string;
  inrRate: number;
  startDate?: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled';
  members: ITripMember[];
  createdAt: Date;
  updatedAt: Date;
}

const tripMemberSchema = new Schema<ITripMember>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    isRegisteredUser: {
      type: Boolean,
      default: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    splitPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    fixedAmount: {
      type: Number,
      min: 0,
    },
  },
  { _id: true }
);

const tripSchema = new Schema<ITrip>(
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
    description: {
      type: String,
      trim: true,
    },
    defaultCurrency: {
      type: String,
      default: 'INR',
    },
    inrRate: {
      type: Number,
      default: 1,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    members: [tripMemberSchema],
  },
  {
    timestamps: true,
  }
);

tripSchema.index({ userId: 1, status: 1 });

export const Trip = mongoose.model<ITrip>('Trip', tripSchema);
