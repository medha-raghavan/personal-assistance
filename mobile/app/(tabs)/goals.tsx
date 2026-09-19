import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  goalService,
  GoalListItem,
  GoalDetail,
  GoalType,
} from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';
import { PageHeader } from '../../components/ui';
import { FinancesAppBar, FinancesSubNav } from '../../components/FinancesSubNav';
import {
  calculateEmi,
  sipFvAtMonths,
  suggestTagFromName,
  normalizeTag,
} from '../../utils/goalCalculations';

const ACCENT = '#7C8CF0';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const TYPE_META: Record<
  GoalType,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  goal: { label: 'Goal', color: '#3b82f6', bg: '#1e3a5f', icon: 'flag-outline' },
  loan: { label: 'Loan', color: '#f59e0b', bg: '#451a03', icon: 'home-outline' },
  sip: { label: 'SIP', color: '#22c55e', bg: '#14532d', icon: 'trending-up-outline' },
};

export default function GoalsScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: goals = [], isLoading, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalService.getAll(),
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setExpandedId(null);
      Alert.alert('Deleted', 'Goal removed. Tagged transactions were kept.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const handleDelete = (goal: GoalListItem) => {
    Alert.alert('Delete Goal', `Delete "${goal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(goal._id),
      },
    ]);
  };

  const renderGoal = ({ item }: { item: GoalListItem }) => {
    const expanded = expandedId === item._id;
    const meta = TYPE_META[item.type];
    const progress = item.progress;
    const percent = progress.progressPercent ?? 0;

    return (
      <View
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
        className="rounded-xl mb-3 border overflow-hidden"
      >
        <TouchableOpacity
          className="p-4"
          onPress={() => setExpandedId(expanded ? null : item._id)}
          activeOpacity={0.7}
        >
          <View className="flex-row items-start gap-3">
            <View
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{ backgroundColor: isDark ? meta.bg : meta.color + '22' }}
            >
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
            <View className="flex-1">
              <View className="flex-row flex-wrap items-center gap-2 mb-1">
                <Text style={{ color: colors.text }} className="font-semibold text-base">
                  {item.name}
                </Text>
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: isDark ? meta.bg : meta.color + '22' }}
                >
                  <Text style={{ color: meta.color }} className="text-[10px] font-semibold">
                    {meta.label}
                  </Text>
                </View>
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-[10px]">
                    {item.tag}
                  </Text>
                </View>
                {progress.isOpenEnded && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1e3a5f' }}>
                    <Text className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>
                      Ongoing
                    </Text>
                  </View>
                )}
              </View>
              <Text style={{ color: colors.textMuted }} className="text-sm">
                {progress.summaryAmount}
              </Text>
              {!progress.isOpenEnded && (
                <View
                  className="mt-2 h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, percent)}%`,
                      backgroundColor: ACCENT,
                    }}
                  />
                </View>
              )}
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <GoalExpandedDetail
            goalId={item._id}
            onDelete={() => handleDelete(item)}
            colors={colors}
            isDark={isDark}
          />
        )}
      </View>
    );
  };

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      <FinancesAppBar subtitle="Goals" />
      <FinancesSubNav active="goals" />
      <FlatList
        data={goals}
        keyExtractor={(item) => item._id}
        renderItem={renderGoal}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <PageHeader
            title="Goals & Planning"
            subtitle="Savings, loans, and SIPs via tags"
          />
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={ACCENT} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View className="items-center py-12">
              <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
                No goals yet.{'\n'}Create a goal, loan, or SIP to get started.
              </Text>
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{ backgroundColor: colors.primary }}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <AddGoalModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
}

function GoalExpandedDetail({
  goalId,
  onDelete,
  colors,
  isDark,
}: {
  goalId: string;
  onDelete: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['goals', goalId],
    queryFn: () => goalService.getById(goalId),
    staleTime: 0,
  });

  if (isLoading || !detail) {
    return (
      <View className="px-4 pb-4 items-center py-6">
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  const stats = detail.stats as Record<string, any>;

  return (
    <View className="px-4 pb-4 border-t" style={{ borderTopColor: colors.border }}>
      <TypeStatsBlock detail={detail} stats={stats} colors={colors} isDark={isDark} />

      <Text style={{ color: colors.text }} className="font-semibold mt-4 mb-1">
        History
      </Text>
      <Text style={{ color: colors.textMuted }} className="text-xs mb-2">
        Completed, already-matched transactions
      </Text>
      {detail.historyEmpty || detail.history.length === 0 ? (
        <Text
          style={{ color: colors.textMuted, borderColor: colors.border }}
          className="text-sm rounded-lg px-3 py-3 border"
        >
          No matching transactions yet. Tag transactions with {detail.tag}.
        </Text>
      ) : (
        detail.history.slice(0, 20).map((tx) => (
          <View
            key={tx._id}
            className="flex-row justify-between py-2 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <View className="flex-1 pr-2">
              <Text style={{ color: colors.text }} numberOfLines={1}>
                {tx.description}
              </Text>
              <Text style={{ color: colors.textMuted }} className="text-xs">
                {formatDate(tx.date)}
              </Text>
            </View>
            <Text style={{ color: colors.text }} className="font-medium">
              {formatCurrency(Math.abs(tx.amount))}
            </Text>
          </View>
        ))
      )}

      <Text style={{ color: colors.text }} className="font-semibold mt-4 mb-1">
        Projected
      </Text>
      <Text style={{ color: colors.textMuted }} className="text-xs mb-2">
        Estimates — not yet completed
      </Text>
      {detail.type === 'goal' &&
      !(stats.typicalMonthlyAmount) &&
      !detail.progress.isComplete ? (
        <Text
          style={{ color: colors.textMuted, borderColor: colors.border }}
          className="text-sm rounded-lg px-3 py-3 border border-dashed"
        >
          A typical monthly contribution is needed to project the remainder.
        </Text>
      ) : detail.projected.items.length === 0 ? (
        <Text
          style={{ color: colors.textMuted, borderColor: colors.border }}
          className="text-sm rounded-lg px-3 py-3 border border-dashed"
        >
          {detail.progress.isComplete
            ? 'Fully paid / matured — nothing left to project.'
            : 'No upcoming installments to show.'}
        </Text>
      ) : (
        <>
          {detail.projected.items.map((row, idx) => (
            <View
              key={`${row.date}-${idx}`}
              className="flex-row justify-between py-2 px-2 mb-1 rounded-lg border border-dashed"
              style={{ borderColor: colors.border, opacity: 0.85 }}
            >
              <View>
                <Text style={{ color: colors.textMuted }}>
                  {row.label || 'Installment'} · estimate
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  {formatDate(row.date)}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted }} className="font-medium">
                {formatCurrency(row.amount)}
              </Text>
            </View>
          ))}
          {detail.projected.moreCount > 0 && (
            <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
              +{detail.projected.moreCount} more until payoff ≈{' '}
              {detail.projected.untilDate
                ? formatDate(detail.projected.untilDate)
                : '—'}
            </Text>
          )}
        </>
      )}

      {detail.chart?.type === 'sip_horizons' && detail.chart.horizons && (
        <View className="mt-4">
          <Text style={{ color: colors.text }} className="font-semibold mb-2">
            Horizon projections
          </Text>
          <View className="flex-row gap-2">
            {detail.chart.horizons
              .filter((h) => [5, 10, 20].includes(h.years))
              .map((h) => (
                <View
                  key={h.years}
                  className="flex-1 rounded-lg px-2 py-2 items-center"
                  style={{ backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }}
                >
                  <Text style={{ color: colors.textMuted }} className="text-xs">
                    {h.years}y
                  </Text>
                  <Text style={{ color: colors.text }} className="text-xs font-semibold mt-1">
                    {formatCurrency(h.value)}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {detail.chart?.type === 'loan_outstanding' && detail.chart.series && (
        <BalanceBars
          title="Outstanding balance"
          points={detail.chart.series
            .filter((_, i, arr) => i % Math.ceil(arr.length / 8) === 0 || i === arr.length - 1)
            .map((p) => ({
              label: `${p.month}m`,
              value: p.outstanding ?? 0,
            }))}
          colors={colors}
          isDark={isDark}
        />
      )}

      {detail.chart?.type === 'sip_value' && detail.chart.series && (
        <BalanceBars
          title="Projected SIP value"
          points={detail.chart.series
            .filter((_, i, arr) => i % Math.ceil(arr.length / 8) === 0 || i === arr.length - 1)
            .map((p) => ({
              label: `${p.month}m`,
              value: p.value ?? 0,
            }))}
          colors={colors}
          isDark={isDark}
        />
      )}

      <TouchableOpacity className="flex-row items-center justify-center mt-4 py-2" onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
        <Text className="text-red-500 ml-2 text-sm">Delete goal</Text>
      </TouchableOpacity>
    </View>
  );
}

function TypeStatsBlock({
  detail,
  stats,
  colors,
  isDark,
}: {
  detail: GoalDetail;
  stats: Record<string, any>;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}) {
  const cell = (label: string, value: string) => (
    <View
      key={label}
      className="w-[48%] rounded-lg px-3 py-2 mb-2"
      style={{ backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }}
    >
      <Text style={{ color: colors.textMuted }} className="text-[10px] uppercase">
        {label}
      </Text>
      <Text style={{ color: colors.text }} className="text-sm font-medium mt-0.5">
        {value}
      </Text>
    </View>
  );

  if (detail.type === 'loan') {
    return (
      <View className="flex-row flex-wrap justify-between mt-3">
        {cell('Outstanding', formatCurrency(stats.outstandingBalance ?? 0))}
        {cell('EMI', formatCurrency(stats.emi ?? 0))}
        {cell('Interest paid', formatCurrency(stats.interestPaidToDate ?? 0))}
        {cell('Interest left', formatCurrency(stats.interestRemaining ?? 0))}
      </View>
    );
  }

  if (detail.type === 'sip') {
    const sip = stats.sip as Record<string, any> | undefined;
    return (
      <View className="flex-row flex-wrap justify-between mt-3">
        {cell('Invested', formatCurrency(stats.invested ?? 0))}
        {cell('Current value', formatCurrency(sip?.currentValue ?? 0))}
        {cell('Return', `${stats.annualRate ?? 0}% p.a.`)}
        {stats.isOpenEnded
          ? cell('Tenure', 'Ongoing')
          : cell('Projected final', formatCurrency(sip?.projectedFinalValue ?? 0))}
      </View>
    );
  }

  const projection = stats.projection as
    | {
        projectionAvailable: boolean;
        monthsNeeded?: number;
        projectedCompletionDate?: string;
      }
    | undefined;

  return (
    <View className="mt-3">
      <View className="flex-row flex-wrap justify-between">
        {cell('Remaining', formatCurrency(stats.remaining ?? 0))}
        {cell(
          'Target date',
          stats.targetDate ? formatDate(stats.targetDate) : 'Not set'
        )}
        {cell(
          'Monthly pace',
          stats.typicalMonthlyAmount
            ? formatCurrency(stats.typicalMonthlyAmount)
            : 'Not set'
        )}
      </View>
      {projection && !projection.projectionAvailable && (stats.remaining ?? 0) > 0 && (
        <Text style={{ color: '#fbbf24' }} className="text-xs mt-1">
          Set a typical monthly contribution to project completion.
        </Text>
      )}
      {projection?.projectionAvailable && (stats.remaining ?? 0) > 0 && (
        <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
          ~{projection.monthsNeeded} months — estimated{' '}
          {projection.projectedCompletionDate
            ? formatDate(projection.projectedCompletionDate)
            : '—'}
        </Text>
      )}
    </View>
  );
}

function BalanceBars({
  title,
  points,
  colors,
  isDark,
}: {
  title: string;
  points: Array<{ label: string; value: number }>;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <View className="mt-4">
      <Text style={{ color: colors.text }} className="font-semibold mb-2">
        {title}
      </Text>
      <View className="flex-row items-end justify-between h-28 gap-1">
        {points.map((p) => (
          <View key={p.label} className="flex-1 items-center justify-end">
            <View
              className="w-full rounded-t"
              style={{
                height: Math.max(4, (p.value / max) * 100),
                backgroundColor: ACCENT,
                opacity: 0.85,
              }}
            />
            <Text style={{ color: colors.textMuted }} className="text-[9px] mt-1">
              {p.label}
            </Text>
          </View>
        ))}
      </View>
      {!isDark && null}
    </View>
  );
}

function AddGoalModal({
  visible,
  onClose,
  colors,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<GoalType>('goal');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [tagTouched, setTagTouched] = useState(false);
  const [form, setForm] = useState({
    targetAmount: '',
    targetDate: '',
    typicalMonthlyAmount: '',
    principal: '',
    annualRate: '',
    tenureMonths: '',
    startDate: '',
    monthlyAmount: '',
  });

  const inputStyle = {
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    color: colors.text,
  };

  const reset = () => {
    setType('goal');
    setName('');
    setTag('');
    setTagTouched(false);
    setForm({
      targetAmount: '',
      targetDate: '',
      typicalMonthlyAmount: '',
      principal: '',
      annualRate: '',
      tenureMonths: '',
      startDate: '',
      monthlyAmount: '',
    });
  };

  useEffect(() => {
    if (!tagTouched && name) {
      setTag(suggestTagFromName(name));
    }
  }, [name, tagTouched]);

  const preview = useMemo(() => {
    if (type === 'loan') {
      const P = parseFloat(form.principal);
      const rate = parseFloat(form.annualRate);
      const n = parseInt(form.tenureMonths, 10);
      if (!P || !n || Number.isNaN(rate)) return null;
      const emi = calculateEmi(P, rate || 0, n);
      return [`EMI: ${formatCurrency(emi)}`, `Total payable: ${formatCurrency(emi * n)}`];
    }
    if (type === 'sip') {
      const M = parseFloat(form.monthlyAmount);
      const rate = parseFloat(form.annualRate);
      if (!M || Number.isNaN(rate)) return null;
      if (!form.tenureMonths.trim()) {
        return [
          'Ongoing SIP (no end date)',
          ...[5, 10, 20].map(
            (y) => `${y}y ≈ ${formatCurrency(sipFvAtMonths(M, rate || 0, y * 12))}`
          ),
        ];
      }
      const n = parseInt(form.tenureMonths, 10);
      if (!n) return null;
      return [`Projected value: ${formatCurrency(sipFvAtMonths(M, rate || 0, n))}`];
    }
    return null;
  }, [type, form]);

  const createMutation = useMutation({
    mutationFn: () => {
      let details: Record<string, unknown>;
      if (type === 'goal') {
        details = {
          targetAmount: parseFloat(form.targetAmount),
          targetDate: form.targetDate || null,
          typicalMonthlyAmount: form.typicalMonthlyAmount
            ? parseFloat(form.typicalMonthlyAmount)
            : null,
        };
      } else if (type === 'loan') {
        details = {
          principal: parseFloat(form.principal),
          annualRate: parseFloat(form.annualRate),
          tenureMonths: parseInt(form.tenureMonths, 10),
          startDate: form.startDate,
        };
      } else {
        details = {
          monthlyAmount: parseFloat(form.monthlyAmount),
          annualRate: parseFloat(form.annualRate),
          tenureMonths: form.tenureMonths.trim()
            ? parseInt(form.tenureMonths, 10)
            : null,
          startDate: form.startDate,
        };
      }
      return goalService.create({
        name: name.trim(),
        type,
        tag: normalizeTag(tag),
        details,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      reset();
      onClose();
      Alert.alert('Success', 'Goal created');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to create');
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    createMutation.mutate();
  };

  const Field = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default' as 'default' | 'numeric' | 'decimal-pad',
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  }) => (
    <View className="mb-3">
      <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">
        {label}
      </Text>
      <TextInput
        className="rounded-lg px-4 py-3"
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[92%]">
          <View
            style={{ borderBottomColor: colors.border }}
            className="flex-row items-center justify-between p-4 border-b"
          >
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              Add Goal
            </Text>
            <TouchableOpacity
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.text }} className="text-sm font-medium mb-2">
              Type
            </Text>
            <View className="flex-row gap-2 mb-4">
              {(['goal', 'loan', 'sip'] as GoalType[]).map((t) => {
                const active = type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    className="flex-1 py-2 rounded-full border items-center"
                    style={{
                      borderColor: active ? ACCENT : colors.border,
                      backgroundColor: active ? (isDark ? '#20233F' : ACCENT + '22') : 'transparent',
                    }}
                  >
                    <Text
                      style={{ color: active ? ACCENT : colors.textSecondary }}
                      className="font-semibold text-sm"
                    >
                      {TYPE_META[t].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Home Loan" />
            <Field
              label="Tag *"
              value={tag}
              onChangeText={(v) => {
                setTagTouched(true);
                setTag(v);
              }}
              placeholder="#home-loan"
            />

            {type === 'goal' && (
              <>
                <Field
                  label="Target amount *"
                  value={form.targetAmount}
                  onChangeText={(v) => setForm({ ...form, targetAmount: v })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Target date (YYYY-MM-DD)"
                  value={form.targetDate}
                  onChangeText={(v) => setForm({ ...form, targetDate: v })}
                  placeholder="Optional"
                />
                <Field
                  label="Typical monthly contribution"
                  value={form.typicalMonthlyAmount}
                  onChangeText={(v) => setForm({ ...form, typicalMonthlyAmount: v })}
                  keyboardType="decimal-pad"
                  placeholder="Optional — for projections only"
                />
              </>
            )}

            {type === 'loan' && (
              <>
                <Field
                  label="Principal *"
                  value={form.principal}
                  onChangeText={(v) => setForm({ ...form, principal: v })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Annual rate (%) *"
                  value={form.annualRate}
                  onChangeText={(v) => setForm({ ...form, annualRate: v })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Tenure (months) *"
                  value={form.tenureMonths}
                  onChangeText={(v) => setForm({ ...form, tenureMonths: v })}
                  keyboardType="number-pad"
                />
                <Field
                  label="Start date (YYYY-MM-DD) *"
                  value={form.startDate}
                  onChangeText={(v) => setForm({ ...form, startDate: v })}
                />
              </>
            )}

            {type === 'sip' && (
              <>
                <Field
                  label="Monthly amount *"
                  value={form.monthlyAmount}
                  onChangeText={(v) => setForm({ ...form, monthlyAmount: v })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Assumed annual return (%) *"
                  value={form.annualRate}
                  onChangeText={(v) => setForm({ ...form, annualRate: v })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Duration (months)"
                  value={form.tenureMonths}
                  onChangeText={(v) => setForm({ ...form, tenureMonths: v })}
                  keyboardType="number-pad"
                  placeholder="Leave blank for an ongoing SIP"
                />
                <Text style={{ color: colors.textMuted }} className="text-xs -mt-2 mb-3">
                  Leave blank for an ongoing SIP with no fixed end date.
                </Text>
                <Field
                  label="Start date (YYYY-MM-DD) *"
                  value={form.startDate}
                  onChangeText={(v) => setForm({ ...form, startDate: v })}
                />
              </>
            )}

            {preview && (
              <View
                className="rounded-lg px-3 py-2 mb-4 border"
                style={{ borderColor: ACCENT + '55', backgroundColor: isDark ? '#20233F' : ACCENT + '14' }}
              >
                <Text style={{ color: ACCENT }} className="text-[10px] uppercase mb-1">
                  Live preview
                </Text>
                {preview.map((line) => (
                  <Text key={line} style={{ color: colors.text }} className="text-sm">
                    {line}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              className="py-4 rounded-xl items-center mb-8"
              style={{
                backgroundColor: createMutation.isPending ? '#94a3b8' : colors.primary,
              }}
              onPress={handleSubmit}
              disabled={createMutation.isPending}
            >
              <Text className="text-white font-semibold text-lg">
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
