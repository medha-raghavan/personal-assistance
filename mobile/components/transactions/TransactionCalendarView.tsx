import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatCompactNumber(amount: number): string {
  if (Math.abs(amount) >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

export interface CalendarTransaction {
  _id: string;
  transactionDate: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  section?: { name: string; _id?: string };
  category?: { name: string; color?: string; _id?: string };
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

function computeCategoryTotals(txns: CalendarTransaction[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const t of txns) {
    const key = t.category?._id || 'uncategorized';
    const name = t.category?.name || 'Uncategorized';
    const color = t.category?.color || colorForKey(key);
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
  return Array.from(map.values()).sort((a, b) => b.credit + b.debit - (a.credit + a.debit));
}

interface DayCellData {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  net: number;
  count: number;
  categoryTotals: CategoryTotal[];
}

interface TransactionCalendarViewProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  transactions: CalendarTransaction[];
  isLoading: boolean;
  onEdit: (transaction: CalendarTransaction) => void;
  onDelete: (transaction: CalendarTransaction) => void;
}

export function TransactionCalendarView({
  month,
  onMonthChange,
  transactions,
  isLoading,
  onEdit,
  onDelete,
}: TransactionCalendarViewProps) {
  const { isDark, colors } = useTheme();
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDateKey(null);
  }, [month]);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const todayKey = toDateKey(new Date());

  const transactionsByDay = useMemo(() => {
    const map = new Map<string, CalendarTransaction[]>();
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
      const credit = dayTransactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      const debit = dayTransactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

      result.push({
        date,
        dateKey,
        inCurrentMonth: dayNum >= 1 && dayNum <= daysInMonth,
        isToday: dateKey === todayKey,
        net: credit - debit,
        count: dayTransactions.length,
        categoryTotals: computeCategoryTotals(dayTransactions),
      });
    }
    return result;
  }, [year, monthIdx, transactionsByDay, todayKey]);

  const goToPrevMonth = () => onMonthChange(new Date(year, monthIdx - 1, 1));
  const goToNextMonth = () => onMonthChange(new Date(year, monthIdx + 1, 1));
  const goToToday = () => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const selectedDayTransactions = selectedDateKey ? transactionsByDay.get(selectedDateKey) || [] : [];
  const selectedDayCategoryTotals = useMemo(
    () => computeCategoryTotals(selectedDayTransactions),
    [selectedDayTransactions]
  );

  const subtleBg = isDark ? '#374151' : '#f3f4f6';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Month navigation */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center gap-1">
          <TouchableOpacity onPress={goToPrevMonth} className="p-1.5 rounded-lg" style={{ backgroundColor: subtleBg }}>
            <Ionicons name="chevron-back" size={18} color={colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextMonth} className="p-1.5 rounded-lg ml-1" style={{ backgroundColor: subtleBg }}>
            <Ionicons name="chevron-forward" size={18} color={colors.icon} />
          </TouchableOpacity>
          <Text style={{ color: colors.text }} className="text-base font-semibold ml-2">
            {monthLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={goToToday} className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: subtleBg }}>
          <Text style={{ color: colors.textSecondary }} className="text-xs font-medium">
            Today
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View className="px-3">
          {/* Weekday header */}
          <View className="flex-row">
            {WEEKDAY_LABELS.map((label, idx) => (
              <View key={idx} style={{ width: '14.2857%' }} className="items-center py-1">
                <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium uppercase">
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View className="flex-row flex-wrap">
            {cells.map((cell) => {
              const isSelected = selectedDateKey === cell.dateKey;
              if (!cell.inCurrentMonth) {
                return <View key={cell.dateKey} style={{ width: '14.2857%', height: 64 }} />;
              }
              return (
                <View key={cell.dateKey} style={{ width: '14.2857%', padding: 2 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedDateKey(cell.dateKey)}
                    style={{
                      height: 64,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : (isDark ? '#374151' : '#e5e7eb'),
                      backgroundColor: isSelected
                        ? (isDark ? '#0c4a6e' : '#e0f2fe')
                        : cell.isToday
                        ? subtleBg
                        : 'transparent',
                      padding: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: cell.isToday ? colors.primary : colors.text,
                        fontWeight: cell.isToday ? '700' : '500',
                        fontSize: 12,
                      }}
                    >
                      {cell.date.getDate()}
                    </Text>
                    {cell.count > 0 && (
                      <>
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 9,
                            fontWeight: '600',
                            color: cell.net >= 0 ? '#16a34a' : '#dc2626',
                            marginTop: 2,
                          }}
                        >
                          {cell.net >= 0 ? '+' : '-'}
                          {formatCompactNumber(Math.abs(cell.net))}
                        </Text>
                        <View className="flex-row mt-1" style={{ gap: 2 }}>
                          {cell.categoryTotals.slice(0, 4).map((ct) => (
                            <View
                              key={ct.key}
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 2.5,
                                backgroundColor: ct.color,
                              }}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Selected day detail */}
      {selectedDateKey && (
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1, marginTop: 12 }} className="px-4 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ color: colors.text }} className="text-base font-semibold flex-1 mr-2">
              {formatDayHeading(selectedDateKey)}
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-xs">
              {selectedDayTransactions.length} txn{selectedDayTransactions.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {selectedDayTransactions.length === 0 ? (
            <Text style={{ color: colors.textMuted }} className="text-center py-6 text-sm">
              No transactions on this day
            </Text>
          ) : (
            <>
              {/* By category */}
              <Text style={{ color: colors.textMuted }} className="text-xs font-medium uppercase mb-2">
                By Category
              </Text>
              <View className="mb-4" style={{ gap: 6 }}>
                {selectedDayCategoryTotals.map((ct) => (
                  <View
                    key={ct.key}
                    className="flex-row items-center px-3 py-2 rounded-lg"
                    style={{ backgroundColor: subtleBg }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ct.color, marginRight: 8 }} />
                    <Text style={{ color: colors.text }} className="text-sm flex-1" numberOfLines={1}>
                      {ct.name} <Text style={{ color: colors.textMuted }}>· {ct.count}</Text>
                    </Text>
                    <Text
                      style={{ color: ct.net >= 0 ? '#16a34a' : '#dc2626' }}
                      className="text-sm font-medium"
                    >
                      {ct.net >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(ct.net))}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Transactions */}
              <View style={{ gap: 8 }}>
                {selectedDayTransactions.map((transaction) => (
                  <TouchableOpacity
                    key={transaction._id}
                    style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
                    className="rounded-xl p-3"
                    onPress={() => onEdit(transaction)}
                    onLongPress={() =>
                      Alert.alert('Delete Transaction', 'Are you sure you want to delete this transaction?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => onDelete(transaction) },
                      ])
                    }
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-3">
                        <Text style={{ color: colors.text }} className="font-medium" numberOfLines={2}>
                          {transaction.description}
                        </Text>
                        <View className="flex-row flex-wrap mt-1" style={{ gap: 4 }}>
                          {transaction.section && (
                            <View className="rounded px-2 py-0.5" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                              <Text style={{ color: colors.textSecondary }} className="text-xs">
                                {transaction.section.name}
                              </Text>
                            </View>
                          )}
                          {transaction.category && (
                            <View
                              className="rounded px-2 py-0.5"
                              style={{ backgroundColor: (transaction.category.color || '#6b7280') + '20' }}
                            >
                              <Text style={{ color: transaction.category.color || '#6b7280' }} className="text-xs">
                                {transaction.category.name}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text
                        className={`font-bold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {transaction.type === 'credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}
