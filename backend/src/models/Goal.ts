import mongoose, { Document, Schema } from 'mongoose';

export type GoalType = 'goal' | 'loan' | 'sip';

export interface IGoalDetailsGoal {
  targetAmount: number;
  targetDate?: Date | null;
  typicalMonthlyAmount?: number | null;
}

export interface IGoalDetailsLoan {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  startDate: Date;
}

export interface IGoalDetailsSip {
  monthlyAmount: number;
  annualRate: number;
  tenureMonths?: number | null;
  startDate: Date;
}

export type IGoalDetails = IGoalDetailsGoal | IGoalDetailsLoan | IGoalDetailsSip;

export interface IGoal extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  tag: string;
  type: GoalType;
  icon: string;
  details: IGoalDetails;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
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
    tag: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['goal', 'loan', 'sip'],
      required: true,
    },
    icon: {
      type: String,
      default: 'target',
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

goalSchema.index({ userId: 1, tag: 1 }, { unique: true });
goalSchema.index({ userId: 1, type: 1 });

export const Goal = mongoose.model<IGoal>('Goal', goalSchema);
