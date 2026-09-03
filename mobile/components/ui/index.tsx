import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../ThemeProvider';

export function Screen({
  children,
  refreshing,
  onRefresh,
  padded = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: padded ? 16 : 0, paddingBottom: 32 }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Panel({
  children,
  style,
  dimmed,
  padded = true,
}: {
  children: ReactNode;
  style?: object;
  dimmed?: boolean;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: padded ? 16 : 0,
        opacity: dimmed ? 0.4 : 1,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-end justify-between mb-4 gap-3">
      <View className="flex-1">
        <Text style={{ color: colors.text }} className="text-xl font-bold">{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary }} className="text-sm mt-1">{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          className="px-3 py-2 rounded-lg"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-white text-sm font-semibold">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className="px-3 py-2 rounded-lg"
            style={{
              backgroundColor: active ? colors.primary : isDark ? colors.panel2 : colors.panel2,
            }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: active ? '#fff' : colors.textSecondary }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function MoneyText({
  amount,
  kind = 'neutral',
  size = 'md',
}: {
  amount: number;
  kind?: 'income' | 'expense' | 'savings' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}) {
  const { colors } = useTheme();
  const color =
    kind === 'income' ? colors.income
      : kind === 'expense' ? colors.expense
        : kind === 'savings' ? colors.savings
          : colors.text;
  const fontSize = size === 'lg' ? 22 : size === 'sm' ? 13 : 16;
  const formatted = '₹' + Math.round(Math.abs(amount)).toLocaleString('en-IN');
  const prefix = amount < 0 || kind === 'expense' ? (kind === 'expense' && amount >= 0 ? '-' : amount < 0 ? '-' : '') : '';
  return (
    <Text style={{ color, fontSize, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
      {prefix}{formatted}
    </Text>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      className="flex-row overflow-hidden rounded-lg"
      style={{ backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.border }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            className="px-3 py-2"
            style={{ backgroundColor: active ? colors.primary + '33' : 'transparent' }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: active ? colors.primary : colors.textSecondary }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
