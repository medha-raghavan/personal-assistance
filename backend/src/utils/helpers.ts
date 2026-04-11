export function getFinancialYear(date: Date): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStartYear = month < 3 ? year - 1 : year;
  return `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}

export function parseDateDDMMYY(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/').map(Number);
  const fullYear = year < 50 ? 2000 + year : 1900 + year;
  return new Date(fullYear, month - 1, day);
}

export function parseDateDDMMYYYY(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function generateCompositeKey(
  date: string,
  amount: number,
  description: string,
  section: string
): string {
  const descSlice = description.slice(0, 50).replace(/\s+/g, '_');
  return `${date}_${amount}_${descSlice}_${section}`.toLowerCase();
}

export function extractKeywordsFromDescription(description: string): string[] {
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
