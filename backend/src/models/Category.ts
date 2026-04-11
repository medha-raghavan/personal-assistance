import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  icon?: string;
  color?: string;
  keywords: string[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
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
    icon: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      default: '#6b7280',
    },
    keywords: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ userId: 1, name: 1 }, { unique: true });
categorySchema.index({ userId: 1, keywords: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'utensils', color: '#f59e0b', keywords: ['lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'sweets', 'juice', 'tea', 'coffee', 'snacks', 'panipuri', 'momo', 'biryani', 'pizza', 'burger', 'zomato', 'swiggy'] },
  { name: 'Transport', icon: 'car', color: '#3b82f6', keywords: ['auto', 'cab', 'uber', 'ola', 'metro', 'train', 'railway', 'chalo', 'rapido', 'fuel', 'petrol', 'diesel'] },
  { name: 'Shopping', icon: 'shopping-bag', color: '#ec4899', keywords: ['amazon', 'flipkart', 'myntra', 'dress', 'clothes', 'shopping', 'mall'] },
  { name: 'Groceries', icon: 'shopping-cart', color: '#22c55e', keywords: ['grocery', 'supermarket', 'vegetable', 'veg', 'milk', 'dairy', 'bigbasket', 'blinkit', 'zepto', 'instamart'] },
  { name: 'Health', icon: 'heart-pulse', color: '#ef4444', keywords: ['doctor', 'hospital', 'medical', 'medicines', 'pharmacy', 'wellness', 'apollo', 'medplus', '1mg'] },
  { name: 'Bills & Utilities', icon: 'receipt', color: '#8b5cf6', keywords: ['cred', 'billdesk', 'recharge', 'electricity', 'gas', 'water', 'internet', 'mobile', 'dth', 'airtel', 'jio', 'vi'] },
  { name: 'Entertainment', icon: 'film', color: '#f97316', keywords: ['movie', 'netflix', 'prime', 'hotstar', 'spotify', 'bookmyshow', 'pvr', 'inox'] },
  { name: 'Personal Care', icon: 'sparkles', color: '#14b8a6', keywords: ['salon', 'parlour', 'haircut', 'spa', 'beauty'] },
  { name: 'Education', icon: 'graduation-cap', color: '#6366f1', keywords: ['udemy', 'course', 'book', 'school', 'college', 'tuition'] },
  { name: 'Investment', icon: 'trending-up', color: '#10b981', keywords: ['mutual', 'fund', 'sip', 'stock', 'share', 'zerodha', 'groww', 'upstox'] },
  { name: 'Transfer', icon: 'arrow-right-left', color: '#64748b', keywords: ['transfer', 'imps', 'neft', 'rtgs', 'upi'] },
  { name: 'Cash Withdrawal', icon: 'banknote', color: '#a855f7', keywords: ['atm', 'atw', 'nwd', 'eaw', 'cash withdrawal'] },
  { name: 'Income', icon: 'wallet', color: '#22c55e', keywords: ['salary', 'neftcr', 'interest', 'refund', 'credited', 'received'] },
  { name: 'Pet', icon: 'paw-print', color: '#f472b6', keywords: ['pet', 'petpalace', 'vet', 'veterinary'] },
  { name: 'Uncategorized', icon: 'help-circle', color: '#6b7280', keywords: [] },
];
