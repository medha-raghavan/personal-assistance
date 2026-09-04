import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useTheme } from './ThemeProvider';
import type { ReactNode } from 'react';

const ACCENT = '#7C8CF0';
const ACCENT_DIM = '#20233F';

export const FINANCES_SUBNAV_ITEMS = [
  { key: 'finances', label: 'Dashboard', href: '/(tabs)/finances', subtitle: 'Overview' },
  { key: 'transactions', label: 'Transactions', href: '/(tabs)/transactions', subtitle: 'Transactions' },
  { key: 'sections', label: 'Accounts', href: '/(tabs)/sections', subtitle: 'Accounts' },
  { key: 'categories', label: 'Categories', href: '/(tabs)/categories', subtitle: 'Categories' },
  { key: 'trips', label: 'Trips', href: '/(tabs)/trips', subtitle: 'Trips' },
  { key: 'tax', label: 'Tax', href: '/(tabs)/tax', subtitle: 'Tax' },
] as const;

export type FinancesSubNavKey = (typeof FINANCES_SUBNAV_ITEMS)[number]['key'];

export function getFinancesSubtitle(pathname: string): string {
  const item = [...FINANCES_SUBNAV_ITEMS]
    .reverse()
    .find((i) => pathname.includes(i.key));
  return item?.subtitle ?? 'Overview';
}

export function FinancesAppBar({ subtitle }: { subtitle?: string }) {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const resolved = subtitle ?? getFinancesSubtitle(pathname);
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: 4,
        backgroundColor: isDark ? '#0B0D12' : colors.background,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.2 }}>
        Finances
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 2 }}>{resolved}</Text>
    </View>
  );
}

export function FinancesSubNav({ active }: { active?: FinancesSubNavKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isDark } = useTheme();

  const resolvedActive: FinancesSubNavKey =
    active ??
    ([...FINANCES_SUBNAV_ITEMS].reverse().find((i) => pathname.includes(i.key))?.key as
      | FinancesSubNavKey
      | undefined) ??
    'finances';

  return (
    <View
      style={{
        backgroundColor: isDark ? '#0B0D12' : colors.background,
        paddingBottom: 8,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FINANCES_SUBNAV_ITEMS.map((item) => {
          const isActive = resolvedActive === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                if (!isActive) router.push(item.href as any);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: isActive ? ACCENT : colors.border,
                backgroundColor: isActive
                  ? isDark
                    ? ACCENT_DIM
                    : ACCENT + '22'
                  : isDark
                    ? '#12151C'
                    : colors.card,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: isActive ? ACCENT : colors.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function FinancesChrome({
  active,
  children,
}: {
  active?: FinancesSubNavKey;
  children?: ReactNode;
}) {
  return (
    <View>
      <FinancesAppBar />
      <FinancesSubNav active={active} />
      {children}
    </View>
  );
}
