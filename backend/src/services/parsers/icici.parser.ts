import pdf from 'pdf-parse';
import { BaseParser, ParserResult } from './base.parser.js';
import { IParsedTransaction } from '../../models/UploadSession.js';

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

      const lines = data.text.split('\n').map(line => line.trim()).filter(line => line);

      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})/;
      const amountRegex = /[\d,]+\.\d{2}/g;

      let currentTransaction: Partial<IParsedTransaction> | null = null;
      let descriptionBuffer: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('DATE') && line.includes('PARTICULARS')) {
          continue;
        }

        const dateMatch = line.match(dateRegex);

        if (dateMatch) {
          if (currentTransaction && currentTransaction.transactionDate) {
            const fullDescription = descriptionBuffer.join(' ').trim();
            if (fullDescription && currentTransaction.amount !== undefined) {
              currentTransaction.description = fullDescription;
              currentTransaction.tags = this.extractKeywordsFromDescription(fullDescription);
              currentTransaction.compositeKey = this.generateCompositeKey(
                currentTransaction.transactionDate.toISOString().split('T')[0],
                currentTransaction.amount,
                fullDescription
              );
              transactions.push(currentTransaction as IParsedTransaction);
            }
          }

          const day = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1;
          const year = parseInt(dateMatch[3], 10);
          const transactionDate = new Date(year, month, day);

          const amounts = line.match(amountRegex);
          let amount = 0;
          let type: 'credit' | 'debit' = 'debit';
          let balance: number | undefined;

          if (amounts && amounts.length > 0) {
            const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, '')));
            
            if (parsedAmounts.length >= 2) {
              balance = parsedAmounts[parsedAmounts.length - 1];
              
              const remainingLine = line.substring(dateMatch[0].length);
              
              if (remainingLine.includes('DEPOSITS') || this.isCredit(line)) {
                amount = parsedAmounts[0];
                type = 'credit';
              } else {
                amount = parsedAmounts[0];
                type = 'debit';
              }
            } else if (parsedAmounts.length === 1) {
              amount = parsedAmounts[0];
              balance = parsedAmounts[0];
            }
          }

          const descriptionStart = line.indexOf(dateMatch[0]) + dateMatch[0].length;
          let descriptionPart = line.substring(descriptionStart);
          
          if (amounts && amounts.length > 0) {
            const firstAmountIndex = descriptionPart.indexOf(amounts[0]);
            if (firstAmountIndex > 0) {
              descriptionPart = descriptionPart.substring(0, firstAmountIndex);
            }
          }

          currentTransaction = {
            transactionDate,
            amount,
            type,
            isDuplicate: false,
            balance,
          };

          descriptionBuffer = [descriptionPart.trim()];
        } else if (currentTransaction) {
          const amounts = line.match(amountRegex);
          if (!amounts || amounts.length === 0) {
            if (!line.match(/^Page \d+/i) && !line.includes('MS.') && !line.includes('PARTICULARS')) {
              descriptionBuffer.push(line);
            }
          } else {
            if (!currentTransaction.amount || currentTransaction.amount === 0) {
              const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, '')));
              if (parsedAmounts.length >= 2) {
                currentTransaction.amount = parsedAmounts[0];
                currentTransaction.balance = parsedAmounts[parsedAmounts.length - 1];
              }
            }
          }
        }
      }

      if (currentTransaction && currentTransaction.transactionDate) {
        const fullDescription = descriptionBuffer.join(' ').trim();
        if (fullDescription && currentTransaction.amount !== undefined) {
          currentTransaction.description = fullDescription;
          currentTransaction.tags = this.extractKeywordsFromDescription(fullDescription);
          currentTransaction.compositeKey = this.generateCompositeKey(
            currentTransaction.transactionDate.toISOString().split('T')[0],
            currentTransaction.amount,
            fullDescription
          );
          transactions.push(currentTransaction as IParsedTransaction);
        }
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

  private isCredit(line: string): boolean {
    const creditIndicators = [
      'NEFTCR',
      'IMPS',
      'Int.Pd',
      'INTEREST',
      'CREDIT',
      'SALARY',
      'REFUND',
    ];
    const upperLine = line.toUpperCase();
    return creditIndicators.some(indicator => upperLine.includes(indicator));
  }
}
