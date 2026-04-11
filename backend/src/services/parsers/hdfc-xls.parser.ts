import * as XLSX from 'xlsx';
import { BaseParser, ParserResult } from './base.parser.js';
import { IParsedTransaction } from '../../models/UploadSession.js';

export class HDFCXLSParser extends BaseParser {
  constructor(sectionName: string = 'HDFC') {
    super(sectionName);
  }

  async parse(fileContent: Buffer | string, fileName: string): Promise<ParserResult> {
    const transactions: IParsedTransaction[] = [];
    const errors: string[] = [];

    try {
      const workbook = XLSX.read(fileContent, { type: 'buffer' });
      
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          transactions: [],
          errors: ['No sheets found in the Excel file'],
        };
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawData: (string | number | null)[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: null 
      });

      // Find the header row by looking for specific patterns
      let headerRowIndex = -1;
      let columnMap: Record<string, number> = {};

      for (let i = 0; i < Math.min(rawData.length, 50); i++) {
        const row = rawData[i];
        if (!row) continue;

        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join('|');
        
        // HDFC Credit Card format: look for DATE and Description headers
        if (rowStr.includes('date') && rowStr.includes('description') && rowStr.includes('amt')) {
          headerRowIndex = i;
          
          // Map column indices
          for (let j = 0; j < row.length; j++) {
            const cellVal = String(row[j] || '').toLowerCase().trim();
            if (cellVal === 'date') columnMap.date = j;
            if (cellVal === 'description') columnMap.description = j;
            if (cellVal === 'amt' || cellVal === 'amount') columnMap.amount = j;
            if (cellVal === 'debit / credit' || cellVal === 'dr/cr') columnMap.type = j;
            if (cellVal === 'transaction type') columnMap.txnType = j;
          }
          break;
        }

        // HDFC Bank Account format: look for Narration
        if (rowStr.includes('date') && (rowStr.includes('narration') || rowStr.includes('particulars'))) {
          headerRowIndex = i;
          
          for (let j = 0; j < row.length; j++) {
            const cellVal = String(row[j] || '').toLowerCase().trim();
            if (cellVal === 'date') columnMap.date = j;
            if (cellVal.includes('narration') || cellVal.includes('particulars') || cellVal === 'description') {
              columnMap.description = j;
            }
            if (cellVal.includes('withdrawal') || cellVal.includes('debit')) columnMap.withdrawal = j;
            if (cellVal.includes('deposit') || cellVal.includes('credit')) columnMap.deposit = j;
            if (cellVal.includes('balance') || cellVal.includes('closing')) columnMap.balance = j;
            if (cellVal.includes('ref') || cellVal.includes('chq')) columnMap.reference = j;
            if (cellVal.includes('value')) columnMap.valueDate = j;
          }
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Try to find data rows directly by looking for date patterns
        for (let i = 0; i < Math.min(rawData.length, 50); i++) {
          const row = rawData[i];
          if (!row) continue;
          
          for (let j = 0; j < row.length; j++) {
            const cellVal = String(row[j] || '');
            if (this.isValidDate(cellVal)) {
              // Found a date, check if there's an amount nearby
              for (let k = j + 1; k < row.length; k++) {
                const potentialAmt = this.parseAmount(row[k]);
                if (potentialAmt > 0) {
                  // This looks like a data row, set header row to previous
                  headerRowIndex = i - 1;
                  columnMap.date = j;
                  // Find description (usually between date and amount)
                  for (let d = j + 1; d < k; d++) {
                    if (row[d] && String(row[d]).length > 5) {
                      columnMap.description = d;
                      break;
                    }
                  }
                  columnMap.amount = k;
                  break;
                }
              }
              if (headerRowIndex !== -1) break;
            }
          }
          if (headerRowIndex !== -1) break;
        }
      }

      console.log('Header row index:', headerRowIndex);
      console.log('Column mapping:', JSON.stringify(columnMap));

      if (headerRowIndex === -1 || Object.keys(columnMap).length === 0) {
        return {
          success: false,
          transactions: [],
          errors: ['Could not detect the header row or column structure in the file'],
        };
      }

      // Process data rows
      const isAccountFormat = columnMap.withdrawal !== undefined || columnMap.deposit !== undefined;
      
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.every(cell => cell === null || cell === '')) continue;

        try {
          const dateValue = row[columnMap.date];
          if (!dateValue || !this.isValidDate(String(dateValue))) continue;

          const transactionDate = this.parseDate(String(dateValue));
          
          // Get description
          let description = '';
          if (columnMap.description !== undefined) {
            description = String(row[columnMap.description] || '').trim();
          }
          
          // If description is empty, look for any non-empty string in the row
          if (!description) {
            for (let j = 0; j < row.length; j++) {
              if (j !== columnMap.date && j !== columnMap.amount) {
                const val = String(row[j] || '').trim();
                if (val.length > 10 && !this.isValidDate(val) && isNaN(this.parseAmount(val))) {
                  description = val;
                  break;
                }
              }
            }
          }

          if (!description) continue;

          let amount = 0;
          let type: 'credit' | 'debit' = 'debit';

          if (isAccountFormat) {
            // Bank account format with separate withdrawal/deposit columns
            const withdrawal = columnMap.withdrawal !== undefined ? this.parseAmount(row[columnMap.withdrawal]) : 0;
            const deposit = columnMap.deposit !== undefined ? this.parseAmount(row[columnMap.deposit]) : 0;
            
            if (withdrawal > 0) {
              amount = withdrawal;
              type = 'debit';
            } else if (deposit > 0) {
              amount = deposit;
              type = 'credit';
            } else {
              continue;
            }
          } else {
            // Credit card format with single amount column
            amount = columnMap.amount !== undefined ? this.parseAmount(row[columnMap.amount]) : 0;
            
            if (amount === 0) {
              // Try to find amount in any column
              for (let j = 0; j < row.length; j++) {
                if (j !== columnMap.date && j !== columnMap.description) {
                  const val = this.parseAmount(row[j]);
                  if (val > 0) {
                    amount = val;
                    break;
                  }
                }
              }
            }
            
            if (amount === 0) continue;

            // Determine type from Debit/Credit column or description
            if (columnMap.type !== undefined) {
              const typeVal = String(row[columnMap.type] || '').toLowerCase();
              type = typeVal.includes('cr') ? 'credit' : 'debit';
            } else {
              // Credit card charges are debits by default, payments/refunds are credits
              const descLower = description.toLowerCase();
              if (descLower.includes('payment') || descLower.includes('refund') || descLower.includes('credit') || descLower.includes('reversal')) {
                type = 'credit';
              }
            }
          }

          const valueDate = columnMap.valueDate !== undefined && row[columnMap.valueDate] 
            ? this.parseDate(String(row[columnMap.valueDate]))
            : undefined;

          const balance = columnMap.balance !== undefined ? this.parseAmount(row[columnMap.balance]) : undefined;
          
          const reference = columnMap.reference !== undefined 
            ? String(row[columnMap.reference] || '').trim() 
            : undefined;

          const compositeKey = this.generateCompositeKey(
            String(dateValue),
            amount,
            description
          );

          const tags = this.extractKeywordsFromDescription(description);

          transactions.push({
            transactionDate,
            valueDate,
            amount,
            type,
            description,
            reference,
            tags,
            compositeKey,
            isDuplicate: false,
            balance,
          });
        } catch (rowError) {
          errors.push(`Row ${i + 1}: ${(rowError as Error).message}`);
        }
      }

      if (transactions.length === 0) {
        return {
          success: false,
          transactions: [],
          errors: ['No valid transactions found in the file. Please check the file format.', 
                   `Detected columns: ${JSON.stringify(columnMap)}`,
                   `Header row: ${headerRowIndex}`],
        };
      }

      console.log(`Successfully parsed ${transactions.length} transactions`);

      return {
        success: true,
        transactions,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        transactions: [],
        errors: [`Failed to parse Excel file: ${(error as Error).message}`],
      };
    }
  }

  private isValidDate(dateStr: string): boolean {
    if (!dateStr || dateStr.trim() === '') return false;
    
    const trimmed = dateStr.trim();
    
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyPattern = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/;
    // YYYY/MM/DD or YYYY-MM-DD
    const yyyymmddPattern = /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/;
    // Excel serial number (5 digits)
    const excelSerialPattern = /^\d{5}$/;
    
    return ddmmyyyyPattern.test(trimmed) || 
           yyyymmddPattern.test(trimmed) ||
           excelSerialPattern.test(trimmed);
  }

  private parseDate(dateStr: string): Date {
    const trimmed = dateStr.trim();
    
    // Excel serial number
    if (/^\d{5}$/.test(trimmed)) {
      const serialNumber = parseInt(trimmed, 10);
      const utcDays = serialNumber - 25569;
      return new Date(utcDays * 86400 * 1000);
    }
    
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      let year = parseInt(ddmmyyyy[3], 10);
      
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      
      return new Date(year, month, day);
    }
    
    // YYYY/MM/DD or YYYY-MM-DD
    const yyyymmdd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10);
      const month = parseInt(yyyymmdd[2], 10) - 1;
      const day = parseInt(yyyymmdd[3], 10);
      
      return new Date(year, month, day);
    }
    
    // Fallback to Date.parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  private parseAmount(value: string | number | null | undefined): number {
    if (value === undefined || value === null || value === '') {
      return 0;
    }

    const strValue = String(value);
    // Remove commas, spaces, and currency symbols
    const cleaned = strValue.replace(/[,\s₹$]/g, '').trim();
    
    if (cleaned === '' || cleaned === '-') {
      return 0;
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : Math.abs(amount);
  }
}
