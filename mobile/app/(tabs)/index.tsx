import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  dashboardService,
  DashboardSummaryFilters,
  DashboardSummaryPeriod,
} from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';
import { SegmentedControl } from '../../components/ui';
import { refreshDashboardWidget } from '../../services/widgetRefresh';

type Period = DashboardSummaryPeriod;
type TxType = NonNullable<DashboardSummaryFilters['type']>;

const PERIODS: { value: Period; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function inr(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

function inrShort(n: number): string {
  if (n >= 1000) return '₹' + Math.round(n / 1000) + 'k';
  return inr(n);
}

function fmtTxDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function DashboardScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const ld = isDark
    ? {
        bg: '#0B0D12',
        panel: '#12151C',
        panel2: '#171B24',
        border: '#242938',
        text: '#E7E9EE',
        dim: '#8B93A3',
        faint: '#5B6273',
        income: '#2DD4A7',
        expense: '#F0654A',
        savings: '#E8A33D',
        accent: '#7C8CF0',
      }
    : {
        bg: colors.background,
        panel: colors.card,
        panel2: colors.panel2,
        border: colors.border,
        text: colors.text,
        dim: colors.textSecondary,
        faint: colors.textMuted,
        income: colors.income,
        expense: colors.expense,
        savings: colors.savings,
        accent: colors.primary,
      };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('30');
  const [sectionId, setSectionId] = useState('');
  const [type, setType] = useState<TxType>('all');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [topKind, setTopKind] = useState<'expense' | 'income'>('expense');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const filters: DashboardSummaryFilters = useMemo(
    () => ({
      period,
      sectionId: sectionId || undefined,
      type,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      startDate: period === 'custom' ? startDate : undefined,
      endDate: period === 'custom' ? endDate : undefined,
    }),
    [period, sectionId, type, categoryIds, startDate, endDate]
  );

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-summary', filters],
    queryFn: () => dashboardService.getSummary(filters),
    placeholderData: keepPreviousData,
  });

  async function onRefresh() {
    await refetch();
    refreshDashboardWidget().catch(() => undefined);
  }

  function handlePeriodChange(next: Period) {
    setPeriod(next);
    if (next === 'custom') {
      setStartDate((prev) => prev || daysAgoIso(30));
      setEndDate((prev) => prev || isoDate(new Date()));
    }
  }

  function resetFilters() {
    setSectionId('');
    setPeriod('30');
    setType('all');
    setCategoryIds([]);
    setStartDate('');
    setEndDate('');
    setTopKind('expense');
  }

  if (isPending && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: ld.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={ld.accent} />
      </View>
    );
  }

  if (isError && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: ld.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: ld.dim, marginBottom: 12 }}>Couldn’t load the dashboard.</Text>
        <TouchableOpacity onPress={() => refetch()} style={{ backgroundColor: ld.panel2, padding: 10, borderRadius: 8 }}>
          <Text style={{ color: ld.accent, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  const dowMax = Math.max(1, ...data.dayOfWeek.days.map((d) => d.amount));
  const trendMax = Math.max(1, ...data.monthlyTrend.flatMap((m) => [m.income, m.expense]));
  const hasDow = data.dayOfWeek.days.some((d) => d.count > 0);
  const insight = data.dayOfWeek.insight;
  const rows = data.topTransactions[topKind];
  const selectedAccountName = data.accounts.find((a) => a.id === sectionId)?.name;
  const catLabel =
    categoryIds.length === 0
      ? 'All categories'
      : categoryIds.length === 1
        ? (data.categories.find((c) => c.id === categoryIds[0])?.name || '1 category')
        : `${categoryIds.length} categories`;

  const card = {
    backgroundColor: ld.panel,
    borderColor: ld.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ld.bg, opacity: isFetching ? 0.9 : 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={isFetching && !isPending} onRefresh={onRefresh} />}
    >
      <View className="flex-row items-end justify-between mb-4">
        <View className="flex-1 pr-3">
          <Text style={{ color: ld.text, fontSize: 19, fontWeight: '700' }}>Financial dashboard</Text>
          <Text style={{ color: ld.dim, fontSize: 12.5, marginTop: 4 }}>{data.meta.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/transactions')}
          style={{ backgroundColor: isDark ? '#20233F' : ld.panel2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Text style={{ color: ld.accent, fontWeight: '600', fontSize: 12 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={{ ...card, overflow: 'hidden', padding: 0 }}>
        <TouchableOpacity
          onPress={() => setFiltersOpen((v) => !v)}
          className="flex-row items-center justify-between"
          style={{ padding: 14 }}
        >
          <View className="flex-row items-center flex-1 flex-wrap gap-2">
            <Text style={{ color: ld.text, fontWeight: '600', fontSize: 13 }}>Filters</Text>
            {!filtersOpen && (
              <>
                <Pill color={ld} label={selectedAccountName || 'All accounts'} />
                <Pill color={ld} label={PERIODS.find((p) => p.value === period)?.label || period} />
                {type !== 'all' && <Pill color={ld} label={type === 'credit' ? 'Income' : 'Expense'} />}
                {categoryIds.length > 0 && <Pill color={ld} label={catLabel} />}
              </>
            )}
          </View>
          <Ionicons name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={16} color={ld.faint} />
        </TouchableOpacity>

        {filtersOpen && (
          <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: ld.border, gap: 12 }}>
            <FieldLabel color={ld} label="Account" />
            <View style={{ backgroundColor: ld.panel2, borderRadius: 8, borderWidth: 1, borderColor: ld.border }}>
              <Picker selectedValue={sectionId} onValueChange={setSectionId} style={{ color: ld.text }}>
                <Picker.Item label="All accounts" value="" color={ld.text} />
                {data.accounts.map((a) => (
                  <Picker.Item key={a.id} label={a.name} value={a.id} color={ld.text} />
                ))}
              </Picker>
            </View>

            <FieldLabel color={ld} label="Period" />
            <View style={{ backgroundColor: ld.panel2, borderRadius: 8, borderWidth: 1, borderColor: ld.border }}>
              <Picker selectedValue={period} onValueChange={(v) => handlePeriodChange(v)} style={{ color: ld.text }}>
                {PERIODS.map((p) => (
                  <Picker.Item key={p.value} label={p.label} value={p.value} color={ld.text} />
                ))}
              </Picker>
            </View>

            {period === 'custom' && (
              <View className="flex-row gap-3">
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFromPicker(true)}>
                  <FieldLabel color={ld} label="From" />
                  <Text style={{ color: ld.text, backgroundColor: ld.panel2, padding: 10, borderRadius: 8 }}>{startDate || 'Start'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowToPicker(true)}>
                  <FieldLabel color={ld} label="To" />
                  <Text style={{ color: ld.text, backgroundColor: ld.panel2, padding: 10, borderRadius: 8 }}>{endDate || 'End'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <FieldLabel color={ld} label="Type" />
            <SegmentedControl
              options={[
                { id: 'all', label: 'All' },
                { id: 'credit', label: 'Income' },
                { id: 'debit', label: 'Expense' },
              ]}
              value={type}
              onChange={(v) => {
                setType(v);
                setCategoryIds([]);
              }}
            />

            <FieldLabel color={ld} label="Categories" />
            <View style={{ maxHeight: 180 }}>
              {data.categories.map((c) => {
                const checked = categoryIds.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    className="flex-row items-center py-2"
                    onPress={() =>
                      setCategoryIds((prev) =>
                        prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )
                    }
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={checked ? ld.accent : ld.dim}
                    />
                    <Text style={{ color: checked ? ld.text : ld.dim, marginLeft: 8 }}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={resetFilters}
              style={{ borderWidth: 1, borderColor: ld.border, borderRadius: 8, padding: 10, alignItems: 'center' }}
            >
              <Text style={{ color: ld.dim, fontSize: 12 }}>Reset filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={card}>
        <Text style={{ color: ld.dim, fontSize: 11.5, marginBottom: 6 }}>Balance</Text>
        <Text style={{ color: ld.text, fontSize: 24, fontWeight: '600' }}>{inr(data.hero.totalBalance)}</Text>
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          {data.accounts.map((a) => (
            <View
              key={a.id}
              style={{
                backgroundColor: ld.panel2,
                borderWidth: 1,
                borderColor: ld.border,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                opacity: sectionId && sectionId !== a.id ? 0.4 : 1,
              }}
            >
              <Text style={{ color: ld.dim, fontSize: 11 }}>
                {a.name} <Text style={{ color: ld.text, fontWeight: '600' }}>{inr(a.balance)}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
        <HeroMini card={card} ld={ld} label="Income" value={inr(data.hero.income)} color={ld.income} foot={`${data.hero.incomeCount} txns`} />
        <HeroMini card={card} ld={ld} label="Expenses" value={inr(data.hero.expense)} color={ld.expense} foot={`${data.hero.expenseCount} txns`} />
        <HeroMini
          card={card}
          ld={ld}
          label="Net"
          value={`${data.hero.net < 0 ? '-' : '+'}${inr(data.hero.net)}`}
          color={ld.savings}
          foot={data.hero.income > 0 ? `${Math.round(data.hero.savingsRate)}% rate` : '—'}
        />
      </View>

      <View style={card}>
        <View className="flex-row justify-between mb-3">
          <Text style={{ color: ld.text, fontWeight: '600', fontSize: 13 }}>Spending by day of week</Text>
          <Text style={{ color: ld.faint, fontSize: 11 }}>{data.meta.periodLabel}</Text>
        </View>
        {!hasDow ? (
          <Text style={{ color: ld.faint, textAlign: 'center', paddingVertical: 24 }}>No expenses match these filters</Text>
        ) : (
          <View className="flex-row items-end" style={{ height: 140, gap: 6 }}>
            {data.dayOfWeek.days.map((d) => (
              <View key={d.label} className="flex-1 items-center justify-end">
                <Text style={{ color: ld.dim, fontSize: 9, marginBottom: 4 }}>{d.amount >= 1000 ? inrShort(d.amount) : inr(d.amount)}</Text>
                <View
                  style={{
                    width: '70%',
                    maxWidth: 28,
                    height: Math.max(3, (d.amount / dowMax) * 100),
                    backgroundColor: d.isWeekend ? ld.savings : ld.expense,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }}
                />
                <Text style={{ color: ld.faint, fontSize: 10, marginTop: 4 }}>{d.label}</Text>
              </View>
            ))}
          </View>
        )}
        {insight && (
          <Text style={{ color: ld.dim, fontSize: 12, marginTop: 12, lineHeight: 18, borderTopWidth: 1, borderTopColor: ld.border, paddingTop: 12 }}>
            Most spending falls on <Text style={{ color: ld.text, fontWeight: '600' }}>{insight.peakDay}</Text> ({inr(insight.peakAmount)}), least on{' '}
            <Text style={{ color: ld.text, fontWeight: '600' }}>{insight.troughDay}</Text>.{' '}
            {insight.weekendsHigher
              ? `Weekends run ${insight.skewPercent}% higher per day than weekdays.`
              : `Weekdays run ${insight.skewPercent}% higher per day than weekends.`}
          </Text>
        )}
      </View>

      <View style={card}>
        <View className="flex-row justify-between mb-3">
          <Text style={{ color: ld.text, fontWeight: '600', fontSize: 13 }}>
            {data.categoryBreakdown.mode === 'income' ? 'Income by source' : 'Spending by category'}
          </Text>
          <Text style={{ color: ld.faint, fontSize: 11 }}>{inr(data.categoryBreakdown.total)} total</Text>
        </View>
        {data.categoryBreakdown.items.length === 0 ? (
          <Text style={{ color: ld.faint, textAlign: 'center', paddingVertical: 20 }}>No transactions match these filters</Text>
        ) : (
          data.categoryBreakdown.items.map((item) => (
            <View key={item.id || item.name} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text style={{ color: ld.text, fontSize: 12 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: ld.dim, fontSize: 12 }}>{inr(item.amount)} · {item.percentage}%</Text>
              </View>
              <View style={{ height: 5, backgroundColor: ld.panel2, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${item.percentage}%`, height: '100%', backgroundColor: item.color || ld.expense, borderRadius: 3 }} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={card}>
        <View className="flex-row justify-between mb-3">
          <Text style={{ color: ld.text, fontWeight: '600', fontSize: 13 }}>Monthly trend</Text>
          <Text style={{ color: ld.faint, fontSize: 11 }}>last 6 months</Text>
        </View>
        <View className="flex-row items-end" style={{ height: 150, gap: 8 }}>
          {data.monthlyTrend.map((m) => (
            <View key={m.period} className="flex-1 items-center justify-end">
              <View className="flex-row items-end" style={{ height: 120, gap: 3 }}>
                <View style={{ width: 10, height: Math.max(2, (m.income / trendMax) * 120), backgroundColor: ld.income, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                <View style={{ width: 10, height: Math.max(2, (m.expense / trendMax) * 120), backgroundColor: ld.expense, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              </View>
              <Text style={{ color: ld.faint, fontSize: 10, marginTop: 6 }}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={{ color: ld.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Spending by account</Text>
      <Text style={{ color: ld.faint, fontSize: 11, marginBottom: 10 }}>reflects period, type and category filters</Text>
      {data.accountBreakdown.map((acc) => (
        <View key={acc.id} style={{ ...card, opacity: acc.dimmed ? 0.4 : 1 }}>
          <View className="flex-row justify-between mb-2">
            <Text style={{ color: ld.text, fontWeight: '700' }}>{acc.name}</Text>
            <Text style={{ color: ld.dim }}>{inr(acc.balance)}</Text>
          </View>
          <View className="flex-row mb-2" style={{ gap: 16 }}>
            <View className="flex-1">
              <Text style={{ color: ld.faint, fontSize: 10 }}>Income</Text>
              <Text style={{ color: ld.income, fontWeight: '600' }}>{inr(acc.income)}</Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: ld.faint, fontSize: 10 }}>Expense</Text>
              <Text style={{ color: ld.expense, fontWeight: '600' }}>{inr(acc.expense)}</Text>
            </View>
          </View>
          {acc.topCategories.length === 0 ? (
            <Text style={{ color: ld.faint, fontSize: 12 }}>No spending in range</Text>
          ) : (
            acc.topCategories.map((c, i) => (
              <View key={`${c.name}-${i}`} className="flex-row justify-between py-1" style={{ borderTopWidth: 1, borderTopColor: ld.border }}>
                <Text style={{ color: ld.dim, fontSize: 12 }}>{c.name}</Text>
                <Text style={{ color: ld.text, fontSize: 12 }}>{inr(c.amount)}</Text>
              </View>
            ))
          )}
        </View>
      ))}

      <View style={card}>
        <View className="flex-row items-center justify-between mb-3 flex-wrap" style={{ gap: 8 }}>
          <Text style={{ color: ld.text, fontWeight: '600', fontSize: 13 }}>Top transactions</Text>
          <SegmentedControl
            options={[
              { id: 'expense', label: 'Expenses' },
              { id: 'income', label: 'Income' },
            ]}
            value={topKind}
            onChange={setTopKind}
          />
        </View>
        {rows.length === 0 ? (
          <Text style={{ color: ld.faint, textAlign: 'center', paddingVertical: 16 }}>
            {topKind === 'income' ? 'No income matches these filters' : 'No expenses match these filters'}
          </Text>
        ) : (
          rows.map((t, i) => {
            const isIn = t.type === 'credit';
            return (
              <View key={t.id} className="py-2" style={{ borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: ld.border }}>
                <View className="flex-row justify-between">
                  <Text style={{ color: ld.faint, fontSize: 11, width: 22 }}>{i + 1}</Text>
                  <Text style={{ color: ld.text, fontWeight: '500', flex: 1 }} numberOfLines={1}>{t.description}</Text>
                  <Text style={{ color: isIn ? ld.income : ld.expense, fontWeight: '600' }}>
                    {isIn ? '+' : '-'}{inr(t.amount)}
                  </Text>
                </View>
                <Text style={{ color: ld.faint, fontSize: 11, marginLeft: 22, marginTop: 2 }}>
                  {fmtTxDate(t.date)} · {t.categoryName} · {t.accountName}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {showFromPicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate + 'T00:00:00') : new Date()}
          mode="date"
          onChange={(_, date) => {
            setShowFromPicker(false);
            if (date) setStartDate(isoDate(date));
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={endDate ? new Date(endDate + 'T00:00:00') : new Date()}
          mode="date"
          onChange={(_, date) => {
            setShowToPicker(false);
            if (date) setEndDate(isoDate(date));
          }}
        />
      )}
    </ScrollView>
  );
}

function Pill({ color, label }: { color: { panel2: string; border: string; dim: string }; label: string }) {
  return (
    <View style={{ backgroundColor: color.panel2, borderWidth: 1, borderColor: color.border, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: color.dim, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function FieldLabel({ color, label }: { color: { faint: string }; label: string }) {
  return <Text style={{ color: color.faint, fontSize: 10.5, fontWeight: '600', marginBottom: 4 }}>{label}</Text>;
}

function HeroMini({
  card,
  ld,
  label,
  value,
  color,
  foot,
}: {
  card: object;
  ld: { dim: string };
  label: string;
  value: string;
  color: string;
  foot: string;
}) {
  return (
    <View style={{ ...card, flex: 1, marginBottom: 0 }}>
      <Text style={{ color: ld.dim, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{value}</Text>
      <Text style={{ color: ld.dim, fontSize: 10, marginTop: 4 }}>{foot}</Text>
    </View>
  );
}
