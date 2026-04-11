export interface ParsedPayment {
  amount: number;
  merchant: string;
  type: 'debit' | 'credit';
  bank?: string;
  accountLast4?: string;
  upiId?: string;
  referenceNumber?: string;
  date: Date;
  rawMessage: string;
}

const BANK_PATTERNS: {
  name: string;
  patterns: RegExp[];
  extract: (match: RegExpMatchArray, message: string) => Partial<ParsedPayment> | null;
}[] = [
  {
    name: 'HDFC',
    patterns: [
      /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s*(?:has been\s*)?debited\s*(?:from\s*(?:A\/c|account)\s*[*xX]*(\d{4}))?.*?(?:to\s+|for\s+|at\s+)([^.]+)/i,
      /INR\s*([\d,]+(?:\.\d{2})?)\s*(?:debited|spent)\s*(?:from\s*(?:A\/c|account)\s*[*xX]*(\d{4}))?.*?(?:to\s+|for\s+|at\s+)([^.]+)/i,
      /Rs\.?\s*([\d,]+(?:\.\d{2})?)\s*credited\s*to\s*(?:A\/c|account)\s*[*xX]*(\d{4})/i,
    ],
    extract: (match, message) => {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const isCredit = /credited/i.test(message);
      return {
        amount,
        accountLast4: match[2],
        merchant: match[3]?.trim() || 'Unknown',
        type: isCredit ? 'credit' : 'debit',
        bank: 'HDFC',
      };
    },
  },
  {
    name: 'ICICI',
    patterns: [
      /(?:Your\s*)?(?:A\/c|Acct|Account)\s*[*xX]*(\d{4})\s*(?:is\s*)?debited\s*(?:for\s*)?(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:on\s*[\d-]+\s*)?(?:for\s+|to\s+)?([^.]+)/i,
      /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*debited\s*from\s*(?:A\/c|account)\s*[*xX]*(\d{4}).*?(?:to|for)\s+([^.]+)/i,
      /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*credited\s*to\s*(?:A\/c|account)\s*[*xX]*(\d{4})/i,
    ],
    extract: (match, message) => {
      const isFirstPattern = /A\/c.*debited.*Rs/i.test(message);
      const amount = parseFloat((isFirstPattern ? match[2] : match[1]).replace(/,/g, ''));
      const accountLast4 = isFirstPattern ? match[1] : match[2];
      const merchant = match[3]?.trim() || 'Unknown';
      const isCredit = /credited/i.test(message);
      return {
        amount,
        accountLast4,
        merchant,
        type: isCredit ? 'credit' : 'debit',
        bank: 'ICICI',
      };
    },
  },
  {
    name: 'SBI',
    patterns: [
      /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:debited|withdrawn)\s*(?:from\s*)?(?:A\/c|account)?\s*[*xX]*(\d{4})?.*?(?:to|for|at)\s+([^.]+)/i,
      /(?:A\/c|account)\s*[*xX]*(\d{4})\s*(?:debited|withdrawn)\s*(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)/i,
    ],
    extract: (match, message) => {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const isCredit = /credited/i.test(message);
      return {
        amount,
        accountLast4: match[2],
        merchant: match[3]?.trim() || 'Unknown',
        type: isCredit ? 'credit' : 'debit',
        bank: 'SBI',
      };
    },
  },
  {
    name: 'Axis',
    patterns: [
      /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:debited|spent)\s*(?:from\s*)?(?:A\/c|account)?\s*[*xX]*(\d{4})?.*?(?:to|for|at)\s+([^.]+)/i,
    ],
    extract: (match, message) => {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const isCredit = /credited/i.test(message);
      return {
        amount,
        accountLast4: match[2],
        merchant: match[3]?.trim() || 'Unknown',
        type: isCredit ? 'credit' : 'debit',
        bank: 'Axis',
      };
    },
  },
  {
    name: 'Kotak',
    patterns: [
      /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:debited|spent|withdrawn)\s*(?:from\s*)?(?:A\/c|account)?\s*[*xX]*(\d{4})?/i,
    ],
    extract: (match, message) => {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      const isCredit = /credited/i.test(message);
      const merchantMatch = message.match(/(?:to|for|at)\s+([^.]+)/i);
      return {
        amount,
        accountLast4: match[2],
        merchant: merchantMatch?.[1]?.trim() || 'Unknown',
        type: isCredit ? 'credit' : 'debit',
        bank: 'Kotak',
      };
    },
  },
];

const UPI_PATTERNS = [
  {
    name: 'Generic UPI Debit',
    pattern: /(?:Paid|Sent)\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)\s*(?:to\s+)?([^@\s]+(?:@[^\s]+)?)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedPayment> => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      merchant: match[2]?.trim() || 'Unknown',
      type: 'debit',
    }),
  },
  {
    name: 'Generic UPI Credit',
    pattern: /(?:Received|Got)\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)\s*(?:from\s+)?([^@\s]+(?:@[^\s]+)?)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedPayment> => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      merchant: match[2]?.trim() || 'Unknown',
      type: 'credit',
    }),
  },
  {
    name: 'GPay/PhonePe Style',
    pattern: /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{2})?)\s*(?:paid|sent|transferred)\s*(?:to\s+)?([^\n.]+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedPayment> => ({
      amount: parseFloat(match[1].replace(/,/g, '')),
      merchant: match[2]?.trim() || 'Unknown',
      type: 'debit',
    }),
  },
  {
    name: 'UPI Reference',
    pattern: /UPI(?:\s*Ref(?:erence)?(?:\s*No)?\.?\s*:?\s*)?(\d+)/i,
    extract: (match: RegExpMatchArray): Partial<ParsedPayment> => ({
      referenceNumber: match[1],
    }),
  },
  {
    name: 'VPA/UPI ID',
    pattern: /([a-zA-Z0-9._-]+@[a-zA-Z]+)/,
    extract: (match: RegExpMatchArray): Partial<ParsedPayment> => ({
      upiId: match[1],
    }),
  },
];

const AMOUNT_PATTERNS = [
  /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d{2})?)/i,
  /([\d,]+(?:\.\d{2})?)\s*(?:Rs\.?|₹|INR)/i,
];

export function parsePaymentSMS(message: string, sender?: string): ParsedPayment | null {
  if (!message) return null;

  const lowerMessage = message.toLowerCase();
  
  if (
    lowerMessage.includes('otp') ||
    lowerMessage.includes('one time password') ||
    lowerMessage.includes('verification code') ||
    lowerMessage.includes('promo') ||
    lowerMessage.includes('offer') ||
    lowerMessage.includes('cashback') && !lowerMessage.includes('debited') ||
    lowerMessage.includes('available balance') && !lowerMessage.includes('debited')
  ) {
    return null;
  }

  const isPaymentMessage = 
    lowerMessage.includes('debited') ||
    lowerMessage.includes('credited') ||
    lowerMessage.includes('paid') ||
    lowerMessage.includes('spent') ||
    lowerMessage.includes('withdrawn') ||
    lowerMessage.includes('transferred') ||
    lowerMessage.includes('received');

  if (!isPaymentMessage) return null;

  let result: Partial<ParsedPayment> = {
    date: new Date(),
    rawMessage: message,
  };

  for (const bankPattern of BANK_PATTERNS) {
    for (const pattern of bankPattern.patterns) {
      const match = message.match(pattern);
      if (match) {
        const extracted = bankPattern.extract(match, message);
        if (extracted && extracted.amount && extracted.amount > 0) {
          result = { ...result, ...extracted };
          break;
        }
      }
    }
    if (result.amount) break;
  }

  if (!result.amount) {
    for (const upiPattern of UPI_PATTERNS) {
      const match = message.match(upiPattern.pattern);
      if (match) {
        const extracted = upiPattern.extract(match);
        result = { ...result, ...extracted };
        if (result.amount) break;
      }
    }
  }

  if (!result.amount) {
    for (const pattern of AMOUNT_PATTERNS) {
      const match = message.match(pattern);
      if (match) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
  }

  if (!result.amount || result.amount <= 0) {
    return null;
  }

  if (!result.type) {
    result.type = /credited|received|got/i.test(message) ? 'credit' : 'debit';
  }

  if (!result.merchant || result.merchant === 'Unknown') {
    const merchantPatterns = [
      /(?:to|at|for)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.|\s*$)/i,
      /(?:from)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s+on|\s+via|\s+ref|\.|\s*$)/i,
    ];
    
    for (const pattern of merchantPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        result.merchant = match[1].trim().substring(0, 50);
        break;
      }
    }
  }

  if (!result.merchant) {
    result.merchant = 'Payment';
  }

  for (const upiPattern of UPI_PATTERNS) {
    if (upiPattern.name.includes('Reference') || upiPattern.name.includes('VPA')) {
      const match = message.match(upiPattern.pattern);
      if (match) {
        const extracted = upiPattern.extract(match);
        result = { ...result, ...extracted };
      }
    }
  }

  return result as ParsedPayment;
}

export function isPaymentSender(sender: string): boolean {
  const paymentSenders = [
    /^[A-Z]{2}-[A-Z]+/i,
    /HDFC/i,
    /ICICI/i,
    /SBI/i,
    /AXIS/i,
    /KOTAK/i,
    /PAYTM/i,
    /PHONEPE/i,
    /GPAY/i,
    /AMAZON/i,
    /FLIPKART/i,
    /UPI/i,
    /BANK/i,
    /^[A-Z]{6}\d{0,2}$/,
  ];

  return paymentSenders.some(pattern => pattern.test(sender));
}

export function cleanMerchantName(name: string): string {
  return name
    .replace(/^(to|from|at|for)\s+/i, '')
    .replace(/\s+(on|via|ref|upi|neft|imps|through).*$/i, '')
    .replace(/[*@]/g, '')
    .trim()
    .substring(0, 50);
}
