import { parse } from 'csv-parse/sync';
import { BaseParser, ParserResult } from './base.parser.js';
import { IParsedTransaction } from '../../models/UploadSession.js';

interface HDFCRow {
  Date: string;
  Description: string;
  Reference: string;
  'Value Date': string;
  Withdrawal: string;
  Deposit: string;
  Balance: string;
}

const BALANCE_TOLERANCE = 0.02;

export class HDFCParser extends BaseParser {
  constructor(sectionName: string = 'HDFC') {
    super(sectionName);
  }

  async parse(fileContent: Buffer | string, fileName: string): Promise<ParserResult> {
    const transactions: IParsedTransaction[] = [];
    const errors: string[] = [];

    try {
      const content = Buffer.isBuffer(fileContent) ? fileContent.toString('utf-8') : fileContent;

      const records: HDFCRow[] = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      for (let i = 0; i < records.length; i++) {
        const row = records[i];

        try {
          if (!row.Date || !row.Description) {
            continue;
          }

          const transactionDate = this.parseDateDDMMYY(row.Date);
          const valueDate = row['Value Date'] ? this.parseDateDDMMYY(row['Value Date']) : undefined;

          const withdrawal = this.parseAmount(row.Withdrawal);
          const deposit = this.parseAmount(row.Deposit);
          const balance = this.parseAmount(row.Balance);

          if (withdrawal === 0 && deposit === 0) {
            continue;
          }

          const amount = withdrawal > 0 ? withdrawal : deposit;
          const type = withdrawal > 0 ? 'debit' : 'credit';

          const compositeKey = this.generateCompositeKey(
            row.Date,
            amount,
            row.Description
          );

          const tags = this.extractKeywordsFromDescription(row.Description);

          transactions.push({
            transactionDate,
            valueDate,
            amount,
            type,
            description: row.Description,
            reference: row.Reference || undefined,
            tags,
            compositeKey,
            isDuplicate: false,
            balance,
          });
        } catch (rowError) {
          errors.push(`Row ${i + 2}: ${(rowError as Error).message}`);
        }
      }

      this.correctTypesUsingBalanceDeltas(transactions);

      return {
        success: true,
        transactions,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        transactions: [],
        errors: [`Failed to parse file: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Older PDF→CSV conversions mislabeled withdrawal vs deposit (UPI=debit,
   * everything else=credit). Use consecutive closing balances as source of truth.
   */
  private correctTypesUsingBalanceDeltas(transactions: IParsedTransaction[]): void {
    let previousBalance: number | undefined;

    for (const tx of transactions) {
      if (tx.balance === undefined || tx.balance === null) {
        continue;
      }

      if (previousBalance !== undefined && tx.amount > 0) {
        const delta = tx.balance - previousBalance;
        const previousAmount = tx.amount;
        const previousType = tx.type;

        if (Math.abs(delta - tx.amount) <= BALANCE_TOLERANCE) {
          tx.type = 'credit';
        } else if (Math.abs(delta + tx.amount) <= BALANCE_TOLERANCE) {
          tx.type = 'debit';
        } else if (Math.abs(delta) > BALANCE_TOLERANCE) {
          tx.amount = Math.abs(delta);
          tx.type = delta > 0 ? 'credit' : 'debit';
        }

        if (tx.amount !== previousAmount || tx.type !== previousType) {
          const dateStr = this.formatDateDDMMYY(tx.transactionDate);
          tx.compositeKey = this.generateCompositeKey(dateStr, tx.amount, tx.description);
        }
      }

      previousBalance = tx.balance;
    }
  }

  private formatDateDDMMYY(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  private parseDateDDMMYY(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month, day);
  }

  private parseAmount(value: string): number {
    if (!value || value.trim() === '') {
      return 0;
    }

    const cleaned = value.replace(/,/g, '').trim();
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : amount;
  }
}
