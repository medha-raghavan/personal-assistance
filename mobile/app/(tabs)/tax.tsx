import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { taxService, investmentService } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month >= 3) {
    return `FY${(year % 100).toString().padStart(2, '0')}-${((year + 1) % 100).toString().padStart(2, '0')}`;
  }
  return `FY${((year - 1) % 100).toString().padStart(2, '0')}-${(year % 100).toString().padStart(2, '0')}`;
}

const INVESTMENT_CATEGORIES = [
  { value: '80C', label: 'Section 80C (PPF, ELSS, LIC)', limit: 150000 },
  { value: '80D', label: 'Section 80D (Health Insurance)', limit: 75000 },
  { value: '80CCD', label: 'Section 80CCD (NPS)', limit: 50000 },
  { value: 'NPS', label: 'NPS (Employer Contribution)', limit: 750000 },
  { value: '80G', label: 'Section 80G (Donations)', limit: 0 },
  { value: 'HRA', label: 'HRA Exemption', limit: 0 },
  { value: 'OTHER', label: 'Other Deductions', limit: 0 },
];

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

const FY_OPTIONS = [
  { value: 'FY25-26', label: 'FY 2025-26' },
  { value: 'FY24-25', label: 'FY 2024-25' },
  { value: 'FY23-24', label: 'FY 2023-24' },
];

type TabType = 'overview' | 'salary' | 'investments' | 'tips';

export default function TaxScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const currentFY = getFinancialYear();
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any>(null);

  const { data: taxCalc, isLoading: taxLoading, refetch: refetchTax } = useQuery({
    queryKey: ['tax-calculation', selectedFY],
    queryFn: () => taxService.calculate(selectedFY),
  });

  const { data: salarySlips = [], refetch: refetchSalary } = useQuery({
    queryKey: ['salary-slips', selectedFY],
    queryFn: () => taxService.getSalarySlips(selectedFY),
  });

  const { data: investments = [], refetch: refetchInvestments } = useQuery({
    queryKey: ['investments', selectedFY],
    queryFn: () => investmentService.getAll(selectedFY),
  });

  const { data: investmentSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['investment-summary', selectedFY],
    queryFn: () => investmentService.getSummary(selectedFY),
  });

  const refetchAll = () => {
    refetchTax();
    refetchSalary();
    refetchInvestments();
    refetchSummary();
  };

  const totalGrossIncome = salarySlips.reduce((sum: number, slip: any) => sum + (slip.grossIncome || 0), 0);

  const getTaxSavingTips = () => {
    const tips: Array<{ title: string; description: string; potential: number; priority: 'high' | 'medium' | 'low' }> = [];

    const cat80C = investmentSummary?.categories?.find((c: any) => c.category === '80C');
    if (!cat80C || cat80C.remaining > 0) {
      const remaining = cat80C?.remaining || 150000;
      tips.push({
        title: 'Maximize Section 80C',
        description: `₹${remaining.toLocaleString()} unused. Options: PPF, ELSS, Tax-saver FD, LIC, Home loan principal.`,
        potential: Math.min(remaining * 0.3, 45000),
        priority: 'high',
      });
    }

    const cat80CCD = investmentSummary?.categories?.find((c: any) => c.category === '80CCD');
    if (!cat80CCD || cat80CCD.remaining > 0) {
      tips.push({
        title: 'Additional NPS (80CCD 1B)',
        description: 'Invest additional ₹50,000 in NPS for extra deduction beyond 80C limit.',
        potential: 15000,
        priority: 'high',
      });
    }

    const cat80D = investmentSummary?.categories?.find((c: any) => c.category === '80D');
    if (!cat80D || cat80D.remaining > 25000) {
      tips.push({
        title: 'Health Insurance (80D)',
        description: 'Claim up to ₹25,000 for self/family + ₹25,000 for parents.',
        potential: 15000,
        priority: 'high',
      });
    }

    if (taxCalc) {
      tips.push({
        title: `${taxCalc.recommendation === 'new' ? 'New' : 'Old'} Regime Recommended`,
        description: taxCalc.recommendation === 'new'
          ? 'New regime has higher standard deduction (₹75,000) and lower tax slabs.'
          : 'Old regime benefits you more with your deductions. Maximize 80C, 80D, HRA.',
        potential: taxCalc.potentialSavings || 0,
        priority: 'high',
      });
    }

    tips.push({
      title: 'Standard Deduction',
      description: 'FY25-26: ₹75,000 (new) / ₹50,000 (old). Applied automatically.',
      potential: 0,
      priority: 'low',
    });

    return tips;
  };

  const tips = getTaxSavingTips();

  return (
    <View style={{ backgroundColor: colors.background }} className="flex-1">
      {/* FY Selector */}
      <View style={{ backgroundColor: colors.card, borderColor: colors.border }} className="px-4 py-3 border-b">
        <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
          <Picker
            selectedValue={selectedFY}
            onValueChange={(value) => setSelectedFY(value)}
            style={{ color: colors.text }}
            dropdownIconColor={colors.icon}
          >
            {FY_OPTIONS.map(opt => (
              <Picker.Item key={opt.value} label={opt.label} value={opt.value} color="#111827" />
            ))}
          </Picker>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ backgroundColor: colors.card }} className="flex-row border-b" style={{ borderBottomColor: colors.border }}>
        {(['overview', 'salary', 'investments', 'tips'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 items-center ${activeTab === tab ? 'border-b-2 border-sky-500' : ''}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              className={`text-sm font-medium capitalize ${activeTab === tab ? 'text-sky-600' : ''}`}
              style={activeTab !== tab ? { color: colors.textMuted } : {}}
            >
              {tab === 'tips' ? 'Tips' : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={taxLoading} onRefresh={refetchAll} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <View className="space-y-4">
            {taxLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textMuted }} className="mt-4">Calculating tax...</Text>
              </View>
            ) : taxCalc ? (
              <>
                {/* New Regime Card */}
                <View
                  style={{ backgroundColor: colors.card, borderColor: taxCalc.recommendation === 'new' ? '#22c55e' : colors.border }}
                  className={`rounded-xl p-4 ${taxCalc.recommendation === 'new' ? 'border-2' : 'border'}`}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text style={{ color: colors.text }} className="text-lg font-semibold">New Tax Regime</Text>
                    {taxCalc.recommendation === 'new' && (
                      <View className="bg-green-500 px-2 py-1 rounded">
                        <Text className="text-white text-xs font-medium">Recommended</Text>
                      </View>
                    )}
                  </View>
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Gross Income</Text>
                      <Text style={{ color: colors.text }}>{formatCurrency(taxCalc.grossIncome || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Standard Deduction</Text>
                      <Text className="text-green-500">-{formatCurrency(taxCalc.newRegime?.standardDeduction || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Taxable Income</Text>
                      <Text style={{ color: colors.text }}>{formatCurrency(taxCalc.newRegime?.taxableIncome || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between pt-2 border-t" style={{ borderTopColor: colors.border }}>
                      <Text style={{ color: colors.text }} className="font-semibold">Tax Payable</Text>
                      <Text className="text-red-500 font-bold text-lg">{formatCurrency(taxCalc.newRegime?.tax || 0)}</Text>
                    </View>
                  </View>
                </View>

                {/* Old Regime Card */}
                <View
                  style={{ backgroundColor: colors.card, borderColor: taxCalc.recommendation === 'old' ? '#22c55e' : colors.border }}
                  className={`rounded-xl p-4 ${taxCalc.recommendation === 'old' ? 'border-2' : 'border'}`}
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <Text style={{ color: colors.text }} className="text-lg font-semibold">Old Tax Regime</Text>
                    {taxCalc.recommendation === 'old' && (
                      <View className="bg-green-500 px-2 py-1 rounded">
                        <Text className="text-white text-xs font-medium">Recommended</Text>
                      </View>
                    )}
                  </View>
                  <View className="space-y-2">
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Gross Income</Text>
                      <Text style={{ color: colors.text }}>{formatCurrency(taxCalc.grossIncome || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Standard Deduction</Text>
                      <Text className="text-green-500">-{formatCurrency(taxCalc.oldRegime?.standardDeduction || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">80C Deduction</Text>
                      <Text className="text-green-500">-{formatCurrency(taxCalc.oldRegime?.deductions?.['80C'] || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">80D Deduction</Text>
                      <Text className="text-green-500">-{formatCurrency(taxCalc.oldRegime?.deductions?.['80D'] || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: colors.textMuted }} className="text-sm">Taxable Income</Text>
                      <Text style={{ color: colors.text }}>{formatCurrency(taxCalc.oldRegime?.taxableIncome || 0)}</Text>
                    </View>
                    <View className="flex-row justify-between pt-2 border-t" style={{ borderTopColor: colors.border }}>
                      <Text style={{ color: colors.text }} className="font-semibold">Tax Payable</Text>
                      <Text className="text-red-500 font-bold text-lg">{formatCurrency(taxCalc.oldRegime?.tax || 0)}</Text>
                    </View>
                  </View>
                </View>

                {/* Savings Card */}
                <View className="bg-green-500/10 border border-green-500 rounded-xl p-4 flex-row items-center">
                  <Ionicons name="trending-up" size={32} color="#22c55e" />
                  <View className="ml-4 flex-1">
                    <Text className="text-green-600 font-semibold">
                      Save {formatCurrency(taxCalc.potentialSavings || 0)} with {taxCalc.recommendation === 'new' ? 'New' : 'Old'} Regime
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="text-sm">
                      Based on your income and deductions
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-8 items-center">
                <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4 text-center">
                  Add salary slips to calculate your tax liability
                </Text>
                <TouchableOpacity
                  className="mt-4 bg-sky-500 px-6 py-3 rounded-xl"
                  onPress={() => { setActiveTab('salary'); setShowSalaryModal(true); }}
                >
                  <Text className="text-white font-semibold">Add Salary Slip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Salary Tab */}
        {activeTab === 'salary' && (
          <View className="space-y-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text style={{ color: colors.textMuted }} className="text-sm">Total Gross Income</Text>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">{formatCurrency(totalGrossIncome)}</Text>
              </View>
              <TouchableOpacity
                className="bg-sky-500 px-4 py-2 rounded-lg flex-row items-center"
                onPress={() => setShowSalaryModal(true)}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white font-medium ml-1">Add</Text>
              </TouchableOpacity>
            </View>

            {salarySlips.length === 0 ? (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-8 items-center">
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4">No salary slips added</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm mt-1">Add monthly salary for accurate tax calculation</Text>
              </View>
            ) : (
              salarySlips.map((slip: any) => (
                <View key={slip._id} style={{ backgroundColor: colors.card }} className="rounded-xl p-4">
                  <View className="flex-row justify-between items-start">
                    <View>
                      <Text style={{ color: colors.text }} className="font-medium">{slip.month}</Text>
                      <Text style={{ color: colors.textMuted }} className="text-sm">Gross: {formatCurrency(slip.grossIncome || 0)}</Text>
                    </View>
                    <Text className="text-green-500 font-bold">{formatCurrency(slip.netSalary || 0)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Investments Tab */}
        {activeTab === 'investments' && (
          <View className="space-y-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text style={{ color: colors.textMuted }} className="text-sm">Total Deductions</Text>
                <Text style={{ color: colors.text }} className="text-2xl font-bold">
                  {formatCurrency(investmentSummary?.totalDeductions || 0)}
                </Text>
              </View>
              <TouchableOpacity
                className="bg-sky-500 px-4 py-2 rounded-lg flex-row items-center"
                onPress={() => { setEditingInvestment(null); setShowInvestmentModal(true); }}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white font-medium ml-1">Add</Text>
              </TouchableOpacity>
            </View>

            {/* Deduction Limits */}
            {investmentSummary?.categories && investmentSummary.categories.length > 0 && (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4">
                <Text style={{ color: colors.text }} className="font-semibold mb-4">Deduction Limits</Text>
                {investmentSummary.categories.map((cat: any) => (
                  <View key={cat.category} className="mb-4 last:mb-0">
                    <View className="flex-row justify-between mb-1">
                      <Text style={{ color: colors.text }} className="font-medium">{cat.category}</Text>
                      <Text style={{ color: colors.textMuted }} className="text-sm">
                        {formatCurrency(cat.utilized || 0)} / {cat.limit > 0 ? formatCurrency(cat.limit) : 'No limit'}
                      </Text>
                    </View>
                    {cat.limit > 0 && (
                      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }}>
                        <View
                          className={`h-full rounded-full ${cat.utilizationPercent >= 100 ? 'bg-green-500' : 'bg-sky-500'}`}
                          style={{ width: `${Math.min(cat.utilizationPercent || 0, 100)}%` }}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Investments List */}
            {investments.length === 0 ? (
              <View style={{ backgroundColor: colors.card }} className="rounded-xl p-8 items-center">
                <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }} className="mt-4">No investments added</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm mt-1">Add tax-saving investments</Text>
              </View>
            ) : (
              investments.map((inv: any) => (
                <TouchableOpacity
                  key={inv._id}
                  style={{ backgroundColor: colors.card }}
                  className="rounded-xl p-4"
                  onPress={() => { setEditingInvestment(inv); setShowInvestmentModal(true); }}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-sky-500/20 px-2 py-0.5 rounded">
                          <Text className="text-sky-500 text-xs font-medium">{inv.category}</Text>
                        </View>
                      </View>
                      <Text style={{ color: colors.text }} className="font-medium mt-2">{inv.name}</Text>
                      {inv.description && (
                        <Text style={{ color: colors.textMuted }} className="text-sm mt-1">{inv.description}</Text>
                      )}
                    </View>
                    <Text className="text-green-500 font-bold text-lg">{formatCurrency(inv.amount || 0)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Tips Tab */}
        {activeTab === 'tips' && (
          <View className="space-y-4">
            <View className="bg-yellow-500/10 border border-yellow-500 rounded-xl p-4 flex-row items-start">
              <Ionicons name="bulb" size={24} color="#eab308" />
              <View className="ml-3 flex-1">
                <Text className="text-yellow-600 font-semibold">Tax Saving Opportunities</Text>
                <Text style={{ color: colors.textMuted }} className="text-sm">
                  Potential savings: <Text className="text-green-500 font-semibold">
                    {formatCurrency(tips.reduce((sum, t) => sum + t.potential, 0))}
                  </Text>
                </Text>
              </View>
            </View>

            {tips.filter(t => t.priority === 'high').length > 0 && (
              <View>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text className="text-red-500 font-medium ml-2">High Priority</Text>
                </View>
                {tips.filter(t => t.priority === 'high').map((tip, index) => (
                  <View
                    key={index}
                    style={{ backgroundColor: colors.card }}
                    className="rounded-xl p-4 mb-3 border-l-4 border-l-red-500"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 mr-3">
                        <Text style={{ color: colors.text }} className="font-semibold">{tip.title}</Text>
                        <Text style={{ color: colors.textMuted }} className="text-sm mt-1">{tip.description}</Text>
                      </View>
                      {tip.potential > 0 && (
                        <View className="items-end">
                          <Text style={{ color: colors.textMuted }} className="text-xs">Savings</Text>
                          <Text className="text-green-500 font-bold">{formatCurrency(tip.potential)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {tips.filter(t => t.priority === 'low').length > 0 && (
              <View>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="information-circle" size={16} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted }} className="font-medium ml-2">Good to Know</Text>
                </View>
                {tips.filter(t => t.priority === 'low').map((tip, index) => (
                  <View
                    key={index}
                    style={{ backgroundColor: colors.card }}
                    className="rounded-xl p-4 mb-3"
                  >
                    <Text style={{ color: colors.text }} className="font-medium">{tip.title}</Text>
                    <Text style={{ color: colors.textMuted }} className="text-sm mt-1">{tip.description}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Important Dates */}
            <View style={{ backgroundColor: colors.card }} className="rounded-xl p-4">
              <Text style={{ color: colors.text }} className="font-semibold mb-4">Important Dates</Text>
              <View className="space-y-3">
                <View className="flex-row justify-between items-center p-3 rounded-lg" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                  <View>
                    <Text style={{ color: colors.text }} className="font-medium">Investment Declaration</Text>
                    <Text style={{ color: colors.textMuted }} className="text-sm">Submit to employer</Text>
                  </View>
                  <View className="bg-sky-500/20 px-2 py-1 rounded">
                    <Text className="text-sky-500 text-xs font-medium">January</Text>
                  </View>
                </View>
                <View className="flex-row justify-between items-center p-3 rounded-lg" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                  <View>
                    <Text style={{ color: colors.text }} className="font-medium">Investment Proofs</Text>
                    <Text style={{ color: colors.textMuted }} className="text-sm">Submit actual proofs</Text>
                  </View>
                  <View className="bg-sky-500/20 px-2 py-1 rounded">
                    <Text className="text-sky-500 text-xs font-medium">February</Text>
                  </View>
                </View>
                <View className="flex-row justify-between items-center p-3 rounded-lg" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                  <View>
                    <Text style={{ color: colors.text }} className="font-medium">ITR Filing</Text>
                    <Text style={{ color: colors.textMuted }} className="text-sm">Last date for filing</Text>
                  </View>
                  <View className="bg-yellow-500/20 px-2 py-1 rounded">
                    <Text className="text-yellow-500 text-xs font-medium">31 July</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Salary Modal */}
      <SalarySlipModal
        visible={showSalaryModal}
        onClose={() => setShowSalaryModal(false)}
        financialYear={selectedFY}
      />

      {/* Add Investment Modal */}
      <InvestmentModal
        visible={showInvestmentModal}
        onClose={() => { setShowInvestmentModal(false); setEditingInvestment(null); }}
        financialYear={selectedFY}
        investment={editingInvestment}
      />
    </View>
  );
}

function SalarySlipModal({
  visible,
  onClose,
  financialYear,
}: {
  visible: boolean;
  onClose: () => void;
  financialYear: string;
}) {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const [formData, setFormData] = useState({
    month: '',
    basic: '',
    hra: '',
    lta: '',
    specialAllowance: '',
    otherAllowances: '',
    pf: '',
    professionalTax: '',
    incomeTax: '',
    otherDeductions: '',
  });

  const grossIncome =
    (parseFloat(formData.basic) || 0) +
    (parseFloat(formData.hra) || 0) +
    (parseFloat(formData.lta) || 0) +
    (parseFloat(formData.specialAllowance) || 0) +
    (parseFloat(formData.otherAllowances) || 0);

  const totalDeductions =
    (parseFloat(formData.pf) || 0) +
    (parseFloat(formData.professionalTax) || 0) +
    (parseFloat(formData.incomeTax) || 0) +
    (parseFloat(formData.otherDeductions) || 0);

  const netSalary = grossIncome - totalDeductions;

  const resetForm = () => {
    setFormData({
      month: '',
      basic: '',
      hra: '',
      lta: '',
      specialAllowance: '',
      otherAllowances: '',
      pf: '',
      professionalTax: '',
      incomeTax: '',
      otherDeductions: '',
    });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      taxService.addSalarySlip({
        financialYear,
        month: formData.month,
        basicSalary: parseFloat(formData.basic) || 0,
        hra: parseFloat(formData.hra) || 0,
        lta: parseFloat(formData.lta) || 0,
        specialAllowance: parseFloat(formData.specialAllowance) || 0,
        otherAllowances: parseFloat(formData.otherAllowances) || 0,
        deductions: {
          pf: parseFloat(formData.pf) || 0,
          professionalTax: parseFloat(formData.professionalTax) || 0,
          incomeTax: parseFloat(formData.incomeTax) || 0,
          other: parseFloat(formData.otherDeductions) || 0,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-slips'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
      resetForm();
      Alert.alert('Success', 'Salary slip added');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add salary slip');
    },
  });

  const handleSubmit = () => {
    if (!formData.month) {
      Alert.alert('Error', 'Please select a month');
      return;
    }
    if (grossIncome === 0) {
      Alert.alert('Error', 'Please enter at least basic salary');
      return;
    }
    addMutation.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl max-h-[90%]">
          <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
            <Text style={{ color: colors.text }} className="text-lg font-semibold">Add Salary Slip</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4">
            {/* Month */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Month *</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.month}
                  onValueChange={(value) => setFormData({ ...formData, month: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                >
                  <Picker.Item label="Select month..." value="" color="#6b7280" />
                  {MONTHS.map((m) => (
                    <Picker.Item key={m} label={m} value={m} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Earnings */}
            <Text className="text-green-500 font-medium mb-2">Earnings</Text>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Basic Salary *</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.basic}
                  onChangeText={(v) => setFormData({ ...formData, basic: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">HRA</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.hra}
                  onChangeText={(v) => setFormData({ ...formData, hra: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">LTA</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.lta}
                  onChangeText={(v) => setFormData({ ...formData, lta: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Other Allowances</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.otherAllowances}
                  onChangeText={(v) => setFormData({ ...formData, otherAllowances: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Deductions */}
            <Text className="text-red-500 font-medium mb-2 mt-4">Deductions</Text>
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">PF</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.pf}
                  onChangeText={(v) => setFormData({ ...formData, pf: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Professional Tax</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.professionalTax}
                  onChangeText={(v) => setFormData({ ...formData, professionalTax: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Income Tax (TDS)</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.incomeTax}
                  onChangeText={(v) => setFormData({ ...formData, incomeTax: v })}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text style={{ color: colors.textMuted }} className="text-xs mb-1">Other Deductions</Text>
                <TextInput
                  className="rounded-lg px-3 py-2"
                  style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.otherDeductions}
                  onChangeText={(v) => setFormData({ ...formData, otherDeductions: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Summary */}
            <View className="rounded-lg p-4 mb-4" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.textMuted }}>Gross Income</Text>
                <Text className="text-green-500 font-medium">{formatCurrency(grossIncome)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text style={{ color: colors.textMuted }}>Total Deductions</Text>
                <Text className="text-red-500 font-medium">-{formatCurrency(totalDeductions)}</Text>
              </View>
              <View className="flex-row justify-between pt-2 border-t" style={{ borderTopColor: colors.border }}>
                <Text style={{ color: colors.text }} className="font-semibold">Net Salary</Text>
                <Text style={{ color: colors.text }} className="font-bold text-lg">{formatCurrency(netSalary)}</Text>
              </View>
            </View>

            <TouchableOpacity
              className={`py-4 rounded-xl items-center mb-6 ${addMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'}`}
              onPress={handleSubmit}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">Add Salary Slip</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InvestmentModal({
  visible,
  onClose,
  financialYear,
  investment,
}: {
  visible: boolean;
  onClose: () => void;
  financialYear: string;
  investment: any;
}) {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const isEditing = !!investment;

  const [formData, setFormData] = useState({
    category: '80C',
    name: '',
    amount: '',
    description: '',
  });

  const [investmentId, setInvestmentId] = useState<string | null>(null);

  if (investment && investment._id !== investmentId) {
    setInvestmentId(investment._id);
    setFormData({
      category: investment.category || '80C',
      name: investment.name || '',
      amount: investment.amount?.toString() || '',
      description: investment.description || '',
    });
  }

  if (!visible && investmentId !== null) {
    setInvestmentId(null);
    setFormData({
      category: '80C',
      name: '',
      amount: '',
      description: '',
    });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      investmentService.create({
        category: formData.category,
        name: formData.name,
        amount: parseFloat(formData.amount) || 0,
        description: formData.description,
        financialYear,
        status: 'active',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
      Alert.alert('Success', 'Investment added');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add investment');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      investmentService.update(investment._id, {
        amount: parseFloat(formData.amount) || 0,
        description: formData.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
      Alert.alert('Success', 'Investment updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to update investment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => investmentService.delete(investment._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
      Alert.alert('Success', 'Investment deleted');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete investment');
    },
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter investment name');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Investment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50 justify-end">
        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl">
          <View style={{ borderBottomColor: colors.border }} className="flex-row items-center justify-between p-4 border-b">
            <Text style={{ color: colors.text }} className="text-lg font-semibold">
              {isEditing ? 'Edit Investment' : 'Add Investment'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <ScrollView className="p-4">
            {/* Category */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Category *</Text>
              <View className="rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: isDark ? '#374151' : '#f9fafb' }}>
                <Picker
                  selectedValue={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.icon}
                  enabled={!isEditing}
                >
                  {INVESTMENT_CATEGORIES.map((cat) => (
                    <Picker.Item key={cat.value} label={cat.label} value={cat.value} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Name */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Name *</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholder="e.g., PPF, ELSS Mutual Fund"
                placeholderTextColor={colors.textMuted}
                value={formData.name}
                onChangeText={(v) => setFormData({ ...formData, name: v })}
                editable={!isEditing}
              />
            </View>

            {/* Amount */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Amount *</Text>
              <View className="flex-row items-center rounded-lg px-4" style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6' }}>
                <Text style={{ color: colors.textSecondary }} className="text-xl">₹</Text>
                <TextInput
                  className="flex-1 py-3 text-xl font-bold ml-2"
                  style={{ color: colors.text }}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={formData.amount}
                  onChangeText={(v) => setFormData({ ...formData, amount: v })}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text style={{ color: colors.text }} className="text-sm font-medium mb-1">Description</Text>
              <TextInput
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: isDark ? '#374151' : '#f3f4f6', color: colors.text }}
                placeholder="Optional notes"
                placeholderTextColor={colors.textMuted}
                value={formData.description}
                onChangeText={(v) => setFormData({ ...formData, description: v })}
              />
            </View>

            <TouchableOpacity
              className={`py-4 rounded-xl items-center mb-4 ${
                createMutation.isPending || updateMutation.isPending ? 'bg-sky-300' : 'bg-sky-500'
              }`}
              onPress={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  {isEditing ? 'Save Changes' : 'Add Investment'}
                </Text>
              )}
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity
                className="py-3 items-center mb-6"
                onPress={handleDelete}
              >
                <Text className="text-red-500 font-medium">Delete Investment</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
