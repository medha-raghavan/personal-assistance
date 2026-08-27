import pdf from 'pdf-parse';
import { BaseParser, ParserResult } from './base.parser.js';
import { IParsedTransaction } from '../../models/UploadSession.js';

type ICICIFormat = 'legacy' | 'modern';

interface PendingTransaction {
  transactionDate: Date;
  descriptionParts: string[];
  amount?: number;
  balance?: number;
}

export class ICICIParser extends BaseParser {
  constructor(sectionName: string = 'ICICI') {
    super(sectionName);
  }

  async parse(fileContent: Buffer | string, fileName: string): Promise<ParserResult> {
    const transactions: IParsedTransaction[] = [];
    const errors: string[] = [];

    try {
      const buffer = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent);
      const data = await pdf(buffer);
      const lines = data.text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const format = this.detectFormat(data.text);
      let pending: PendingTransaction | null = null;
      let previousBalance: number | undefined;

      for (const line of lines) {
        if (this.shouldSkipLine(line)) {
          continue;
        }

        if (line.includes('Statement of Transactions')) {
          previousBalance = undefined;
        }

        const dateInfo = this.parseDateLine(line, format);
        if (dateInfo) {
          if (pending) {
            previousBalance = this.finalizeTransaction(
              pending,
              previousBalance,
              transactions
            );
          }

          pending = {
            transactionDate: dateInfo.date,
            descriptionParts: dateInfo.descriptionPrefix ? [dateInfo.descriptionPrefix] : [],
          };
          continue;
        }

        if (!pending) {
          continue;
        }

        if (this.isBalanceForwardLine(line)) {
          pending.descriptionParts.push('B/F');
          continue;
        }

        const amounts = this.parseAmountLine(line, pending.descriptionParts);
        if (amounts) {
          if (amounts.amount !== undefined) {
            pending.amount = amounts.amount;
          }
          pending.balance = amounts.balance;
          continue;
        }

        if (pending.amount !== undefined && pending.balance !== undefined) {
          continue;
        }

        if (!this.isFooterOrHeaderLine(line)) {
          pending.descriptionParts.push(line);
        }
      }

      if (pending) {
        this.finalizeTransaction(pending, previousBalance, transactions);
      }

      return {
        success: true,
        transactions: transactions.filter(t => t.amount > 0),
        errors,
      };
    } catch (error) {
      return {
        success: false,
        transactions: [],
        errors: [`Failed to parse PDF: ${(error as Error).message}`],
      };
    }
  }

  private detectFormat(text: string): ICICIFormat {
    if (
      /Cheque Number.*Transaction Remarks/i.test(text) ||
      /\d+\d{2}\.\d{2}\.\d{4}/.test(text) ||
      /Withdrawal\s+Amount \(INR\)/i.test(text)
    ) {
      return 'modern';
    }
    return 'legacy';
  }

  private parseDateLine(
    line: string,
    format: ICICIFormat
  ): { date: Date; descriptionPrefix?: string } | null {
    if (format === 'modern') {
      const spaced = line.match(/^(\d+)\s+(\d{2})\.(\d{2})\.(\d{4})(?:\s+(.*))?$/);
      if (spaced) {
        return {
          date: this.buildDate(parseInt(spaced[2], 10), parseInt(spaced[3], 10), parseInt(spaced[4], 10)),
          descriptionPrefix: spaced[5]?.trim() || undefined,
        };
      }

      const compact = line.match(/^(\d+)(\d{2})\.(\d{2})\.(\d{4})$/);
      if (compact) {
        return {
          date: this.buildDate(parseInt(compact[2], 10), parseInt(compact[3], 10), parseInt(compact[4], 10)),
        };
      }

      return null;
    }

    const legacyOnly = line.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (legacyOnly) {
      return {
        date: this.buildDate(
          parseInt(legacyOnly[1], 10),
          parseInt(legacyOnly[2], 10),
          parseInt(legacyOnly[3], 10)
        ),
      };
    }

    const legacyWithText = line.match(/^(\d{2})-(\d{2})-(\d{4})(.+)$/);
    if (legacyWithText) {
      const suffix = legacyWithText[4].trim();
      if (/^B\/F\b/i.test(suffix)) {
        return {
          date: this.buildDate(
            parseInt(legacyWithText[1], 10),
            parseInt(legacyWithText[2], 10),
            parseInt(legacyWithText[3], 10)
          ),
          descriptionPrefix: 'B/F',
        };
      }

      return {
        date: this.buildDate(
          parseInt(legacyWithText[1], 10),
          parseInt(legacyWithText[2], 10),
          parseInt(legacyWithText[3], 10)
        ),
        descriptionPrefix: suffix,
      };
    }

    return null;
  }

  private buildDate(day: number, month: number, year: number): Date {
    return new Date(year, month - 1, day);
  }

  private parseAmountLine(
    line: string,
    descriptionParts: string[]
  ): { amount?: number; balance: number } | null {
    if (/^TOTAL/i.test(line)) {
      return null;
    }

    const cleaned = line.replace(/,/g, '').trim();
    const parts = cleaned.match(/\d+\.\d{2}/g);
    if (!parts || parts.length === 0) {
      return null;
    }

    const nonAmount = cleaned.replace(/\d+\.\d{2}/g, '').trim();
    if (nonAmount.length > 0) {
      return null;
    }

    if (parts.length >= 2) {
      return {
        amount: parseFloat(parts[parts.length - 2]),
        balance: parseFloat(parts[parts.length - 1]),
      };
    }

    const isBalanceForward = descriptionParts.some(part => /^B\/F$/i.test(part.trim()));
    if (isBalanceForward) {
      return { balance: parseFloat(parts[0]) };
    }

    return null;
  }

  private finalizeTransaction(
    pending: PendingTransaction,
    previousBalance: number | undefined,
    transactions: IParsedTransaction[]
  ): number | undefined {
    const description = pending.descriptionParts.join(' ').replace(/\s+/g, ' ').trim();

    if (this.isBalanceForward(description)) {
      if (pending.balance !== undefined) {
        return pending.balance;
      }
      if (pending.amount !== undefined) {
        return pending.amount;
      }
      return previousBalance;
    }

    if (!pending.amount || pending.amount <= 0) {
      return previousBalance;
    }

    const type = this.resolveType(
      pending.amount,
      pending.balance,
      previousBalance,
      description
    );

    const transaction: IParsedTransaction = {
      transactionDate: pending.transactionDate,
      amount: pending.amount,
      type,
      description,
      tags: this.extractKeywordsFromDescription(description),
      compositeKey: this.generateCompositeKey(
        pending.transactionDate.toISOString().split('T')[0],
        pending.amount,
        description
      ),
      isDuplicate: false,
      balance: pending.balance,
    };

    transactions.push(transaction);

    if (pending.balance !== undefined) {
      return pending.balance;
    }

    return previousBalance;
  }

  private shouldSkipLine(line: string): boolean {
    if (/^Page \d+/i.test(line)) {
      return true;
    }
    if (/^TOTAL/i.test(line)) {
      return true;
    }
    if (/^S No\.$/.test(line) || line === 'Transaction' || line === 'Date') {
      return true;
    }
    if (line.includes('DATE') && line.includes('PARTICULARS')) {
      return true;
    }
    if (line.includes('Cheque Number') && line.includes('Transaction Remarks')) {
      return true;
    }
    if (/^Withdrawal$|^Deposit$|^Balance$/.test(line)) {
      return true;
    }
    if (/^Amount \(INR\)$/.test(line)) {
      return true;
    }
    if (/^(\d+)$/.test(line) && parseInt(line, 10) <= 20) {
      return true;
    }
    return false;
  }

  private isFooterOrHeaderLine(line: string): boolean {
    const markers = [
      'Never share your OTP',
      'www.icici',
      'Dial your Bank',
      'Please call from',
      'MS.MEDHA',
      'MEDHA RAGHAVAN',
      'Your Base Branch',
      'Visit www.icicibank.com',
      'Summary of Accounts',
      'ACCOUNT DETAILS',
      'Legends for transactions',
      'This is a system generated statement',
      'Team ICICI Bank',
      'RCHG - Recharge',
      'Sincerly,',
    ];
    return markers.some(marker => line.includes(marker));
  }

  private isBalanceForwardLine(line: string): boolean {
    return /^B\/F$/i.test(line.trim());
  }

  private isBalanceForward(description: string): boolean {
    return /\bB\/F\b/i.test(description.trim());
  }

  private resolveType(
    amount: number,
    balance: number | undefined,
    previousBalance: number | undefined,
    description: string
  ): 'credit' | 'debit' {
    if (balance !== undefined && previousBalance !== undefined && amount > 0) {
      const delta = balance - previousBalance;
      if (Math.abs(Math.abs(delta) - amount) < 0.02) {
        return delta > 0 ? 'credit' : 'debit';
      }
    }
    if (this.isCredit(description)) {
      return 'credit';
    }
    return 'debit';
  }

  private isCredit(line: string): boolean {
    const creditIndicators = [
      'NEFTCR',
      'NEFT-N',
      'NEFT CR',
      'INT.PD',
      'INTEREST',
      'CREDIT',
      'SALARY',
      'REFUND',
      'TAX REFUND',
      'CMS/TRF',
      'BIL/INFT',
      'MMT/IMPS',
    ];
    const upperLine = line.toUpperCase();
    if (creditIndicators.some(indicator => upperLine.includes(indicator))) {
      return true;
    }
    if (/MMT\/IMPS\/.*\/(SALARY|SAL)/i.test(line)) {
      return true;
    }
    return false;
  }
}
