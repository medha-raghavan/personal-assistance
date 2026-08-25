import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IGoogleAuth {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: Date;
  email?: string;
  connectedAt?: Date;
}

export interface ITickTickAuth {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: Date;
  connectedAt?: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  google?: IGoogleAuth;
  ticktick?: ITickTickAuth;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const googleAuthSchema = new Schema<IGoogleAuth>(
  {
    accessToken: { type: String },
    refreshToken: { type: String },
    expiryDate: { type: Date },
    email: { type: String, trim: true, lowercase: true },
    connectedAt: { type: Date },
  },
  { _id: false }
);

const ticktickAuthSchema = new Schema<ITickTickAuth>(
  {
    accessToken: { type: String },
    refreshToken: { type: String },
    expiryDate: { type: Date },
    connectedAt: { type: Date },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    google: {
      type: googleAuthSchema,
      required: false,
    },
    ticktick: {
      type: ticktickAuthSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const obj = ret as unknown as {
      passwordHash?: string;
      google?: {
        accessToken?: string;
        refreshToken?: string;
      };
      ticktick?: {
        accessToken?: string;
        refreshToken?: string;
      };
    };
    delete obj.passwordHash;
    if (obj.google) {
      delete obj.google.accessToken;
      delete obj.google.refreshToken;
    }
    if (obj.ticktick) {
      delete obj.ticktick.accessToken;
      delete obj.ticktick.refreshToken;
    }
    return obj;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
