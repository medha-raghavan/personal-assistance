export interface CreditCardColumnMap {
  date?: number;
  description?: number;
  amount?: number;
  type?: number;
  txnType?: number;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function isCreditCardCsvHeaders(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const hasAmount = normalized.includes('amount');
  const hasTypeColumn = normalized.includes('dr/cr') || normalized.includes('type');
  return hasAmount && hasTypeColumn;
}

export function isCreditCardXlsHeaderRow(rowStr: string): boolean {
  const lower = rowStr.toLowerCase();
  return lower.includes('date') && lower.includes('description') && lower.includes('amt');
}

export function mapCreditCardColumns(row: (string | number | null)[]): CreditCardColumnMap {
  const columnMap: CreditCardColumnMap = {};

  for (let j = 0; j < row.length; j++) {
    const cellVal = String(row[j] || '').toLowerCase().trim();
    if (!cellVal) continue;

    if (cellVal === 'date' || cellVal === 'date & time' || cellVal.startsWith('date ')) {
      columnMap.date = j;
    }
    if (cellVal === 'description') {
      columnMap.description = j;
    }
    if (cellVal === 'amt' || cellVal === 'amount') {
      columnMap.amount = j;
    }
    if (cellVal === 'debit / credit' || cellVal === 'dr/cr') {
      columnMap.type = j;
    }
    if (cellVal === 'type') {
      columnMap.txnType = j;
    }
    if (cellVal === 'transaction type') {
      columnMap.txnType = j;
    }
  }

  return columnMap;
}

export function isCreditCardDate(dateStr: string): boolean {
  if (!dateStr || dateStr.trim() === '') return false;

  const trimmed = dateStr.trim();
  const datePart = trimmed.split(' / ')[0].trim();

  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(datePart)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(datePart)) return true;
  if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(datePart)) return true;
  if (/^\d{5}$/.test(datePart)) return true;

  const parsed = new Date(datePart);
  return !isNaN(parsed.getTime());
}

export function parseCreditCardDate(dateStr: string): Date {
  const trimmed = dateStr.trim();
  const datePart = trimmed.split(' / ')[0].trim();

  if (/^\d{5}$/.test(datePart)) {
    const serialNumber = parseInt(datePart, 10);
    const utcDays = serialNumber - 25569;
    return new Date(utcDays * 86400 * 1000);
  }

  const ddMonYyyy = datePart.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (ddMonYyyy) {
    const day = parseInt(ddMonYyyy[1], 10);
    const month = MONTH_MAP[ddMonYyyy[2].toLowerCase()];
    const year = parseInt(ddMonYyyy[3], 10);
    if (month === undefined) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return new Date(year, month, day);
  }

  const ddmmyyyy = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    let year = parseInt(ddmmyyyy[3], 10);

    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }

    return new Date(year, month, day);
  }

  const yyyymmdd = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10) - 1;
    const day = parseInt(yyyymmdd[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(datePart);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Invalid date format: ${dateStr}`);
}

export function parseCreditCardAmount(value: string | number | null | undefined): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const cleaned = String(value).replace(/[,\s₹$]/g, '').trim();
  if (cleaned === '' || cleaned === '-') {
    return 0;
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

export function resolveCreditCardType(
  row: (string | number | null)[] | Record<string, string | undefined>,
  columnMap: CreditCardColumnMap,
  description: string
): 'credit' | 'debit' {
  if (columnMap.type !== undefined) {
    const typeVal = getCellValue(row, columnMap.type).toLowerCase();
    if (typeVal.includes('cr')) return 'credit';
    if (typeVal.includes('dr')) return 'debit';
    if (typeVal === '') return 'debit';
  }

  if (columnMap.txnType !== undefined) {
    const typeVal = getCellValue(row, columnMap.txnType).toLowerCase();
    if (typeVal === 'credit') return 'credit';
    if (typeVal === 'debit') return 'debit';
  }

  if (!Array.isArray(row)) {
    const drCr = (row['DR/CR'] || '').toLowerCase();
    if (drCr.includes('cr')) return 'credit';
    if (drCr.includes('dr')) return 'debit';

    const typeCol = (row.Type || '').toLowerCase();
    if (typeCol === 'credit') return 'credit';
    if (typeCol === 'debit') return 'debit';
  }

  const descLower = description.toLowerCase();
  if (
    descLower.includes('payment') ||
    descLower.includes('refund') ||
    descLower.includes('reversal')
  ) {
    return 'credit';
  }

  return 'debit';
}

function getCellValue(
  row: (string | number | null)[] | Record<string, string | undefined>,
  index: number
): string {
  if (Array.isArray(row)) {
    return String(row[index] ?? '').trim();
  }
  return '';
}
