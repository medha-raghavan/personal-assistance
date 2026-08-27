import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Badge } from '../common';
import { formatCurrency, formatCompactNumber } from '../../utils/formatters';
import { Transaction, Category, Section } from '../../types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_PALETTE = [
  '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

interface CategoryTotal {
  key: string;
  name: string;
  color: string;
  credit: number;
  debit: number;
  net: number;
  count: number;
}

function computeCategoryTotals(txns: Transaction[], categories: Category[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of txns) {
    const catObj = typeof t.categoryId === 'object' ? (t.categoryId as Category) : categories.find((c) => c._id === t.categoryId);
    const key = catObj?._id || 'uncategorized';
    const name = catObj?.name || 'Uncategorized';
    const color = catObj?.color || colorForKey(key);
    let entry = map.get(key);
    if (!entry) {
      entry = { key, name, color, credit: 0, debit: 0, net: 0, count: 0 };
      map.set(key, entry);
    }
    if (t.type === 'credit') {
      entry.credit += t.amount;
    } else {
      entry.debit += t.amount;
    }
    entry.net = entry.credit - entry.debit;
    entry.count += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.credit + b.debit) - (a.credit + a.debit)
  );
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function formatDayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface DayCellData {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  credit: number;
  debit: number;
  net: number;
  count: number;
  categoryTotals: CategoryTotal[];
}

interface TransactionCalendarViewProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  transactions: Transaction[];
  isLoading: boolean;
  categories: Category[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

export function TransactionCalendarView({
  month,
  onMonthChange,
  transactions,
  isLoading,
  categories,
  onEdit,
  onDelete,
}: TransactionCalendarViewProps) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDateKey(null);
  }, [month]);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const todayKey = toDateKey(new Date());

  const transactionsByDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const key = toDateKey(new Date(t.transactionDate));
      const existing = map.get(key);
      if (existing) {
        existing.push(t);
      } else {
        map.set(key, [t]);
      }
    }
    return map;
  }, [transactions]);

  const cells = useMemo<DayCellData[]>(() => {
    const firstWeekday = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    const result: DayCellData[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstWeekday + 1;
      const date = new Date(year, monthIdx, dayNum);
      const dateKey = toDateKey(date);
      const dayTransactions = transactionsByDay.get(dateKey) || [];
      const credit = dayTransactions
        .filter((t) => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0);
      const debit = dayTransactions
        .filter((t) => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);

      result.push({
        date,
        dateKey,
        inCurrentMonth: dayNum >= 1 && dayNum <= daysInMonth,
        isToday: dateKey === todayKey,
        credit,
        debit,
        net: credit - debit,
        count: dayTransactions.length,
        categoryTotals: computeCategoryTotals(dayTransactions, categories),
      });
    }
    return result;
  }, [year, monthIdx, transactionsByDay, todayKey, categories]);

  const goToPrevMonth = () => onMonthChange(new Date(year, monthIdx - 1, 1));
  const goToNextMonth = () => onMonthChange(new Date(year, monthIdx + 1, 1));
  const goToToday = () => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const selectedDayTransactions = selectedDateKey ? transactionsByDay.get(selectedDateKey) || [] : [];
  const selectedDayCategoryTotals = useMemo(
    () => computeCategoryTotals(selectedDayTransactions, categories),
    [selectedDayTransactions, categories]
  );

  const getCategoryInfo = (categoryId?: string | Category) => {
    if (!categoryId) return null;
    if (typeof categoryId === 'object') return categoryId;
    return categories.find((c) => c._id === categoryId);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-gray-700">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h2 className="text-sm sm:text-lg font-semibold text-white ml-1 sm:ml-2">{monthLabel}</h2>
        </div>
        <button
          onClick={goToToday}
          className="px-2.5 py-1.5 text-xs sm:text-sm rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-600 transition-colors"
        >
          Today
        </button>
      </div>

      <div className="p-2 sm:p-4">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading calendar...</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase py-1"
                >
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.slice(0, 1)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {cells.map((cell) => {
                const isSelected = selectedDateKey === cell.dateKey;
                const visibleCategories = cell.categoryTotals.slice(0, 3);
                const hiddenCategoryCount = cell.categoryTotals.length - visibleCategories.length;
                const tooltip = cell.categoryTotals
                  .map((ct) => `${ct.name}: ${ct.net >= 0 ? '+' : '-'}${formatCurrency(Math.abs(ct.net))}`)
                  .join('\n');

                return (
                  <button
                    key={cell.dateKey}
                    onClick={() => cell.inCurrentMonth && setSelectedDateKey(cell.dateKey)}
                    disabled={!cell.inCurrentMonth}
                    title={tooltip || undefined}
                    className={`relative flex flex-col items-start rounded-lg p-1 sm:p-2 min-h-[52px] sm:min-h-[96px] text-left transition-colors border ${
                      !cell.inCurrentMonth
                        ? 'border-transparent cursor-default opacity-0 pointer-events-none'
                        : isSelected
                        ? 'border-primary-500 bg-primary-900/30'
                        : cell.isToday
                        ? 'border-primary-700 bg-gray-700/40 hover:bg-gray-700/60'
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-700/40'
                    }`}
                  >
                    <span
                      className={`text-[11px] sm:text-sm font-medium ${
                        cell.isToday
                          ? 'inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary-600 text-white'
                          : 'text-gray-300'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {cell.count > 0 && (
                      <div className="mt-0.5 sm:mt-1 w-full space-y-0.5 min-w-0">
                        {/* Compact net total, shown on mobile where per-category rows don't fit */}
                        <div
                          className={`sm:hidden text-[9px] font-semibold truncate ${
                            cell.net >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {cell.net >= 0 ? '+' : '-'}
                          {formatCompactNumber(Math.abs(cell.net))}
                        </div>

                        {/* Category-wise breakdown, shown on larger screens */}
                        <div className="hidden sm:flex sm:flex-col gap-0.5 w-full">
                          {visibleCategories.map((ct) => (
                            <div key={ct.key} className="flex items-center gap-1 min-w-0">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: ct.color }}
                              />
                              <span className="text-[10px] text-gray-400 truncate flex-1">{ct.name}</span>
                              <span
                                className={`text-[10px] font-medium flex-shrink-0 ${
                                  ct.net >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {formatCompactNumber(Math.abs(ct.net))}
                              </span>
                            </div>
                          ))}
                          {hiddenCategoryCount > 0 && (
                            <div className="text-[9px] text-gray-500">
                              +{hiddenCategoryCount} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedDateKey && (
        <div className="border-t border-gray-700 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-semibold text-white">
              {formatDayHeading(selectedDateKey)}
            </h3>
            <span className="text-xs text-gray-500">
              {selectedDayTransactions.length} transaction{selectedDayTransactions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedDayTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No transactions on this day</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">By Category</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {selectedDayCategoryTotals.map((ct) => (
                    <div
                      key={ct.key}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800/60 border border-gray-700"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ct.color }}
                      />
                      <span className="text-xs text-gray-300 truncate flex-1">
                        {ct.name}
                        <span className="text-gray-500"> · {ct.count}</span>
                      </span>
                      <span
                        className={`text-xs font-medium flex-shrink-0 ${
                          ct.net >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {ct.net >= 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(ct.net))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {selectedDayTransactions.map((transaction) => {
                  const section = transaction.sectionId as Section;
                  const category = getCategoryInfo(transaction.categoryId);
                  return (
                    <div
                      key={transaction._id}
                      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-800/60 border border-gray-700"
                    >
                      <div
                        className={`p-1 rounded flex-shrink-0 mt-0.5 ${
                          transaction.type === 'credit'
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                        }`}
                      >
                        {transaction.type === 'credit' ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm text-gray-200 break-words">
                          {transaction.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                          <Badge size="sm">{section?.name || 'Unknown'}</Badge>
                          {category && (
                            <Badge variant="info" size="sm">
                              {category.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-medium whitespace-nowrap ${
                            transaction.type === 'credit' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {transaction.type === 'credit' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEdit(transaction)}
                            className="p-1 text-gray-400 hover:text-primary-400 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Delete this transaction?')) {
                                onDelete(transaction._id);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
