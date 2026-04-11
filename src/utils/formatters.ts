export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactNumber(amount: number): string {
  if (Math.abs(amount) >= 10000000) {
    return `${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (Math.abs(amount) >= 100000) {
    return `${(amount / 100000).toFixed(2)}L`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toFixed(0);
}

export function formatDate(date: string | Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    short: { day: 'numeric', month: 'short' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  }[format];
  
  return d.toLocaleDateString('en-IN', options);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function getFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStartYear = month < 3 ? year - 1 : year;
  return `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
}
