import { IParsedTransaction } from '../../models/UploadSession.js';

export interface ParserResult {
  success: boolean;
  transactions: IParsedTransaction[];
  errors: string[];
}

export abstract class BaseParser {
  protected sectionName: string;

  constructor(sectionName: string) {
    this.sectionName = sectionName;
  }

  abstract parse(fileContent: Buffer | string, fileName: string): Promise<ParserResult>;

  protected generateCompositeKey(
    date: string,
    amount: number,
    description: string
  ): string {
    const descSlice = description.slice(0, 50).replace(/\s+/g, '_');
    return `${date}_${amount}_${descSlice}_${this.sectionName}`.toLowerCase();
  }

  protected extractKeywordsFromDescription(description: string): string[] {
    const keywords: string[] = [];
    const lowerDesc = description.toLowerCase();

    const knownKeywords = [
      'doctor', 'hospital', 'medical', 'medicines', 'pharmacy', 'wellness',
      'lunch', 'dinner', 'breakfast', 'food', 'restaurant', 'sweets', 'juice',
      'tea', 'coffee', 'snacks', 'panipuri', 'pani puri', 'momo', 'swiggy', 'zomato',
      'auto', 'cab', 'uber', 'ola', 'metro', 'train', 'railway', 'chalo', 'rapido',
      'grocery', 'supermarket', 'vegetable', 'veg', 'milk', 'dairy', 'instamart',
      'pet', 'petpalace',
      'salon', 'parlour', 'haircut',
      'salary', 'neftcr', 'interest', 'refund', 'credited',
      'cred', 'billdesk', 'recharge', 'electricity', 'gas',
      'atm', 'atw', 'nwd', 'eaw', 'cash',
      'movie', 'netflix', 'prime', 'hotstar',
      'amazon', 'flipkart', 'dress', 'clothes', 'myntra',
      'udemy', 'course',
      'transfer', 'imps', 'neft', 'upi',
      'makemytrip', 'flight', 'hotel', 'booking',
    ];

    for (const keyword of knownKeywords) {
      if (lowerDesc.includes(keyword) && !keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    return keywords;
  }
}
