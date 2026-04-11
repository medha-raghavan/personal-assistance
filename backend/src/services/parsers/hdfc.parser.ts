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
