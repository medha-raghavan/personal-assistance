import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calculator, TrendingUp, FileText, CheckCircle, Plus, Trash2, 
  AlertTriangle, Lightbulb, DollarSign, Upload, X, Edit2 
} from 'lucide-react';
import { Card, CardHeader, Button, Select, Badge, Input, Modal } from '../components/common';
import { taxService, investmentService } from '../services/tax.service';
import { formatCurrency, getFinancialYear } from '../utils/formatters';
import { SalarySlip, Investment } from '../types';

const INVESTMENT_CATEGORIES = [
  { value: '80C', label: 'Section 80C (PPF, ELSS, LIC, etc.)', limit: 150000 },
  { value: '80D', label: 'Section 80D (Health Insurance)', limit: 75000 },
  { value: '80CCD', label: 'Section 80CCD (NPS)', limit: 50000 },
  { value: 'NPS', label: 'NPS (Employer Contribution)', limit: 750000 },
  { value: '80G', label: 'Section 80G (Donations)', limit: 0 },
  { value: 'HRA', label: 'HRA Exemption', limit: 0 },
  { value: 'LTA', label: 'LTA Exemption', limit: 0 },
  { value: 'OTHER', label: 'Other Deductions', limit: 0 },
];

const MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

export function Tax() {
  const queryClient = useQueryClient();
  const currentFY = getFinancialYear();
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [activeTab, setActiveTab] = useState<'overview' | 'salary' | 'investments' | 'tips'>('overview');
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  
  const { data: taxCalc, isLoading: taxLoading } = useQuery({
    queryKey: ['tax-calculation', selectedFY],
    queryFn: () => taxService.calculateTax(selectedFY),
  });
  
  const { data: salarySlips = [] } = useQuery({
    queryKey: ['salary-slips', selectedFY],
    queryFn: () => taxService.getSalarySlips(selectedFY),
  });

  const { data: investments = [] } = useQuery({
    queryKey: ['investments', selectedFY],
    queryFn: () => investmentService.getAll({ fy: selectedFY }),
  });
  
  const { data: investmentSummary } = useQuery({
    queryKey: ['investment-summary', selectedFY],
    queryFn: () => investmentService.getSummary(selectedFY),
  });
  
  const fyOptions = [
    { value: 'FY25-26', label: 'FY 2025-26' },
    { value: 'FY24-25', label: 'FY 2024-25' },
    { value: 'FY23-24', label: 'FY 2023-24' },
  ];

  const getTaxSavingTips = () => {
    const tips: Array<{ title: string; description: string; potential: number; priority: 'high' | 'medium' | 'low'; category?: string }> = [];
    
    const grossIncome = taxCalc?.grossIncome || totalGrossIncome;
    const basicSalary = salarySlips.reduce((s, slip) => s + (slip.basicSalary || 0), 0);
    const hraReceived = salarySlips.reduce((s, slip) => s + (slip.hra || 0), 0);

    // 80C - Most important for old regime
    const cat80C = investmentSummary?.categories.find(c => c.category === '80C');
    if (!cat80C || cat80C.remaining > 0) {
      const remaining = cat80C?.remaining || 150000;
      tips.push({
        title: 'Maximize Section 80C (₹1.5 Lakh limit)',
        description: `You have ₹${remaining.toLocaleString()} unused. Options: PPF (safe, 7.1%), ELSS (3yr lock-in, market-linked), Tax-saver FD (5yr), LIC premium, Children tuition fees, Home loan principal.`,
        potential: Math.min(remaining * 0.3, 45000),
        priority: 'high',
        category: '80C',
      });
    }

    // 80CCD(1B) - Additional NPS benefit
    const cat80CCD = investmentSummary?.categories.find(c => c.category === '80CCD');
    if (!cat80CCD || cat80CCD.remaining > 0) {
      tips.push({
        title: 'Additional NPS Investment (80CCD 1B)',
        description: `Invest additional ₹50,000 in NPS for extra deduction beyond 80C limit. This gives ~₹15,000 tax saving at 30% bracket.`,
        potential: 15000,
        priority: 'high',
        category: '80CCD',
      });
    }

    // 80D - Health Insurance
    const cat80D = investmentSummary?.categories.find(c => c.category === '80D');
    if (!cat80D || cat80D.remaining > 25000) {
      tips.push({
        title: 'Health Insurance Premium (80D)',
        description: `Claim up to ₹25,000 for self/family + ₹25,000 for parents (₹50,000 if parents are senior citizens). Also covers preventive health checkup up to ₹5,000.`,
        potential: Math.min(50000 * 0.3, 15000),
        priority: 'high',
        category: '80D',
      });
    }

    // HRA Exemption - Only if they have HRA component
    if (hraReceived > 0 && salarySlips.length > 0 && taxCalc?.recommendation === 'old') {
      const annualHRA = hraReceived * 12 / salarySlips.length;
      tips.push({
        title: 'Claim HRA Exemption',
        description: `You receive ₹${annualHRA.toLocaleString()} HRA annually. If you pay rent, claim exemption = Min of (Actual HRA, 50% of Basic for metro/40% for non-metro, Rent paid - 10% of Basic). Keep rent receipts and landlord PAN (if rent >₹1L/year).`,
        potential: Math.min(annualHRA * 0.4, 100000),
        priority: 'high',
        category: 'HRA',
      });
    }

    // Home Loan Interest - 80EEA or Section 24
    if (grossIncome > 700000) {
      tips.push({
        title: 'Home Loan Tax Benefits',
        description: `Section 24: Deduct up to ₹2 Lakh interest on home loan. Section 80EEA: Additional ₹1.5 Lakh for first-time buyers (stamp value <₹45L). Principal repayment qualifies under 80C.`,
        potential: 60000,
        priority: 'medium',
        category: 'Home Loan',
      });
    }

    // New Regime vs Old Regime advice
    if (taxCalc) {
      const savings = taxCalc.potentialSavings;
      const totalOldDeductions = taxCalc.oldRegime?.deductions 
        ? taxCalc.oldRegime.standardDeduction + Object.values(taxCalc.oldRegime.deductions).reduce((a, b) => a + b, 0)
        : 0;
      tips.push({
        title: `${taxCalc.recommendation === 'new' ? 'New' : 'Old'} Regime is Better for You`,
        description: taxCalc.recommendation === 'new' 
          ? `With your current deductions, New Tax Regime saves you ₹${savings.toLocaleString()}. New regime has higher standard deduction (₹75,000) and lower tax slabs but no 80C/80D deductions.`
          : `With your deductions of ₹${totalOldDeductions.toLocaleString()}, Old Regime saves you ₹${savings.toLocaleString()}. Maximize your 80C, 80D, HRA to increase savings.`,
        potential: savings,
        priority: 'high',
        category: 'Regime',
      });
    }

    // LTA Exemption
    const ltaReceived = salarySlips.reduce((s, slip) => s + (slip.lta || 0), 0);
    if (ltaReceived > 0) {
      tips.push({
        title: 'Claim LTA Exemption',
        description: `You have LTA component in salary. Claim exemption for domestic travel (only travel fare, not hotel/food). Keep tickets and boarding passes. Can be claimed twice in a block of 4 years.`,
        potential: ltaReceived,
        priority: 'medium',
        category: 'LTA',
      });
    }

    // Professional Tax
    tips.push({
      title: 'Deduct Professional Tax',
      description: `Professional tax deducted from salary (usually ₹200-300/month, max ₹2,500/year) is fully deductible under Section 16.`,
      potential: 2500,
      priority: 'low',
      category: 'Professional Tax',
    });

    // Standard Deduction reminder
    tips.push({
      title: 'Standard Deduction Applied Automatically',
      description: selectedFY === 'FY25-26' 
        ? `FY 2025-26: Standard deduction is ₹75,000 under new regime and ₹50,000 under old regime. This is automatically applied - no proof needed.`
        : `Standard deduction of ₹50,000 is automatically applied for both regimes. No proof required.`,
      potential: 0,
      priority: 'low',
      category: 'Info',
    });

    // Document tips
    tips.push({
      title: 'Keep These Documents Ready',
      description: 'Form 16 (employer), 26AS (tax credit statement), rent receipts with landlord PAN, home loan statements, investment proofs (PPF/ELSS/LIC), medical insurance premium receipts, donation receipts (80G).',
      potential: 0,
      priority: 'low',
      category: 'Documents',
    });

    return tips;
  };

  const totalGrossIncome = salarySlips.reduce((sum, slip) => sum + slip.grossIncome, 0);
  const tips = getTaxSavingTips();
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Tax Calculator</h1>
          <p className="text-sm sm:text-base text-gray-400">Compare regimes, manage deductions & get tips</p>
        </div>
        <Select
          options={fyOptions}
          value={selectedFY}
          onChange={setSelectedFY}
        />
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 sm:gap-2 border-b border-gray-700 pb-2 min-w-max">
          {(['overview', 'salary', 'investments', 'tips'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === tab
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 hover:bg-gray-700'
            }`}
          >
            {tab === 'tips' ? 'Tax Tips' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {taxLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : taxCalc ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Card className={taxCalc.recommendation === 'new' ? 'ring-2 ring-green-500' : ''}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">New Tax Regime</h3>
                    {taxCalc.recommendation === 'new' && (
                      <Badge variant="success">Recommended</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gross Income</span>
                      <span className="text-white">{formatCurrency(taxCalc.grossIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Standard Deduction</span>
                      <span className="text-green-400">
                        -{formatCurrency(taxCalc.newRegime.standardDeduction)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                      <span className="text-gray-400">Taxable Income</span>
                      <span className="text-white">{formatCurrency(taxCalc.newRegime.taxableIncome)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-700 pt-3">
                      <span className="text-white">Tax Payable</span>
                      <span className="text-red-400">{formatCurrency(taxCalc.newRegime.tax)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Tax Breakdown</h4>
                    <div className="space-y-1">
                      {taxCalc.newRegime.breakdown.map((item, index) => (
                        <div key={index} className="flex justify-between text-xs text-gray-400">
                          <span>{item.slab}</span>
                          <span>{formatCurrency(item.tax)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
                
                <Card className={taxCalc.recommendation === 'old' ? 'ring-2 ring-green-500' : ''}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Old Tax Regime</h3>
                    {taxCalc.recommendation === 'old' && (
                      <Badge variant="success">Recommended</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Gross Income</span>
                      <span className="text-white">{formatCurrency(taxCalc.grossIncome)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Standard Deduction</span>
                      <span className="text-green-400">
                        -{formatCurrency(taxCalc.oldRegime.standardDeduction)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">80C Deduction</span>
                      <span className="text-green-400">
                        -{formatCurrency(taxCalc.oldRegime.deductions['80C'])}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">80D Deduction</span>
                      <span className="text-green-400">
                        -{formatCurrency(taxCalc.oldRegime.deductions['80D'])}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">80CCD (NPS)</span>
                      <span className="text-green-400">
                        -{formatCurrency(taxCalc.oldRegime.deductions['80CCD'])}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
                      <span className="text-gray-400">Taxable Income</span>
                      <span className="text-white">{formatCurrency(taxCalc.oldRegime.taxableIncome)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-700 pt-3">
                      <span className="text-white">Tax Payable</span>
                      <span className="text-red-400">{formatCurrency(taxCalc.oldRegime.tax)}</span>
                    </div>
                  </div>
                </Card>
              </div>
              
              <Card className="bg-gradient-to-r from-green-900/40 to-blue-900/40 border-green-700">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-500/20 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      You can save {formatCurrency(taxCalc.potentialSavings)} with{' '}
                      {taxCalc.recommendation === 'new' ? 'New' : 'Old'} Regime
                    </h3>
                    <p className="text-sm text-gray-400">
                      Based on your current income and deductions
                    </p>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                Add salary slips to calculate your tax liability
              </p>
              <Button onClick={() => { setActiveTab('salary'); setShowSalaryModal(true); }}>
                Add Salary Slip
              </Button>
            </Card>
          )}
        </>
      )}

      {activeTab === 'salary' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Gross Income</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalGrossIncome)}</p>
            </div>
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowSalaryModal(true)}>
              Add Salary Slip
            </Button>
          </div>

          {salarySlips.length === 0 ? (
            <Card className="text-center py-12">
              <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No salary slips added yet</p>
              <p className="text-sm text-gray-500 mb-4">Add your monthly salary details for accurate tax calculation</p>
              <Button onClick={() => setShowSalaryModal(true)}>Add Salary Slip</Button>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Month</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Basic</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase hidden md:table-cell">HRA</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Deductions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {salarySlips.map((slip) => (
                    <tr key={slip._id} className="hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-300">{slip.month || 'N/A'}</td>
                      <td className="px-4 py-3 text-right text-white">{formatCurrency(slip.grossIncome)}</td>
                      <td className="px-4 py-3 text-right text-gray-400 hidden sm:table-cell">{formatCurrency(slip.basicSalary || 0)}</td>
                      <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">{formatCurrency(slip.hra || 0)}</td>
                      <td className="px-4 py-3 text-right text-red-400 hidden md:table-cell">
                        -{formatCurrency((slip.deductions?.pf || 0) + (slip.deductions?.professionalTax || 0) + (slip.deductions?.incomeTax || 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium">{formatCurrency(slip.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-700/30 border-t border-gray-700">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(totalGrossIncome)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-400 hidden sm:table-cell">
                      {formatCurrency(salarySlips.reduce((s, slip) => s + (slip.basicSalary || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-400 hidden md:table-cell">
                      {formatCurrency(salarySlips.reduce((s, slip) => s + (slip.hra || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400 hidden md:table-cell">
                      -{formatCurrency(salarySlips.reduce((s, slip) => s + (slip.deductions?.pf || 0) + (slip.deductions?.professionalTax || 0) + (slip.deductions?.incomeTax || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">
                      {formatCurrency(salarySlips.reduce((s, slip) => s + slip.netSalary, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'investments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Deductions</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(investmentSummary?.totalDeductions || 0)}
              </p>
            </div>
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => { setEditingInvestment(null); setShowInvestmentModal(true); }}>
              Add Investment
            </Button>
          </div>

          {investmentSummary && investmentSummary.categories.length > 0 && (
            <Card>
              <CardHeader title="Deduction Limits" subtitle="Track your utilization against limits" />
              <div className="space-y-4">
                {investmentSummary.categories.map((cat) => (
                  <div key={cat.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{cat.category}</span>
                      <span className="text-sm text-gray-400">
                        {formatCurrency(cat.utilized)} / {cat.limit > 0 ? formatCurrency(cat.limit) : 'No limit'}
                      </span>
                    </div>
                    {cat.limit > 0 && (
                      <>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              cat.utilizationPercent >= 100 ? 'bg-green-500' : 'bg-primary-500'
                            }`}
                            style={{ width: `${Math.min(cat.utilizationPercent, 100)}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          {cat.utilizationPercent.toFixed(1)}% utilized
                          {cat.remaining > 0 && ` • ${formatCurrency(cat.remaining)} remaining`}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {investments.length === 0 ? (
            <Card className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">No investments added yet</p>
              <p className="text-sm text-gray-500 mb-4">Add your tax-saving investments for deduction calculation</p>
              <Button onClick={() => { setEditingInvestment(null); setShowInvestmentModal(true); }}>Add Investment</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {investments.map((inv) => (
                <Card key={inv._id} className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge size="sm">{inv.category}</Badge>
                      {inv.subCategory && <span className="text-xs text-gray-500">{inv.subCategory}</span>}
                    </div>
                    <p className="text-white font-medium mt-2">{inv.name}</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(inv.amount)}</p>
                    {inv.description && <p className="text-sm text-gray-400 mt-1">{inv.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingInvestment(inv); setShowInvestmentModal(true); }}
                      className="p-1 text-gray-400 hover:text-primary-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tips' && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-700">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Lightbulb className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-2">Tax Saving Opportunities for {selectedFY}</h3>
                <p className="text-sm text-gray-400">
                  Personalized suggestions based on your salary structure and investments. 
                  Total potential savings: <span className="text-green-400 font-semibold">
                    {formatCurrency(tips.reduce((sum, t) => sum + t.potential, 0))}
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {tips.length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-400">Great job! You've maximized your tax savings.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* High Priority Tips */}
              {tips.filter(t => t.priority === 'high').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> High Priority Actions
                  </h3>
                  <div className="space-y-3">
                    {tips.filter(t => t.priority === 'high').map((tip, index) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-white">{tip.title}</h4>
                              {tip.category && (
                                <Badge size="sm" variant="info">{tip.category}</Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm">{tip.description}</p>
                          </div>
                          {tip.potential > 0 && (
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-xs text-gray-500">Potential savings</p>
                              <p className="text-lg font-bold text-green-400">{formatCurrency(tip.potential)}</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Medium Priority Tips */}
              {tips.filter(t => t.priority === 'medium').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" /> Consider These Options
                  </h3>
                  <div className="space-y-3">
                    {tips.filter(t => t.priority === 'medium').map((tip, index) => (
                      <Card key={index} className="border-l-4 border-l-yellow-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-white">{tip.title}</h4>
                              {tip.category && (
                                <Badge size="sm">{tip.category}</Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm">{tip.description}</p>
                          </div>
                          {tip.potential > 0 && (
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-xs text-gray-500">Potential savings</p>
                              <p className="text-lg font-bold text-green-400">{formatCurrency(tip.potential)}</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Priority / Info Tips */}
              {tips.filter(t => t.priority === 'low').length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Good to Know
                  </h3>
                  <div className="space-y-3">
                    {tips.filter(t => t.priority === 'low').map((tip, index) => (
                      <Card key={index} className="border-l-4 border-l-gray-600 bg-gray-800/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-medium text-white">{tip.title}</h4>
                              {tip.category && (
                                <Badge size="sm" variant="default">{tip.category}</Badge>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm">{tip.description}</p>
                          </div>
                          {tip.potential > 0 && (
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="text-xs text-gray-500">Potential</p>
                              <p className="text-sm font-medium text-green-400">{formatCurrency(tip.potential)}</p>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Card>
            <CardHeader title="Important Dates" subtitle="Don't miss these deadlines" />
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Investment Declaration</p>
                  <p className="text-sm text-gray-400">Submit to employer</p>
                </div>
                <Badge>January</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">Investment Proofs</p>
                  <p className="text-sm text-gray-400">Submit actual proofs</p>
                </div>
                <Badge>February</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">ITR Filing (Non-audit)</p>
                  <p className="text-sm text-gray-400">Last date for filing</p>
                </div>
                <Badge variant="warning">31st July</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      <SalarySlipModal
        isOpen={showSalaryModal}
        onClose={() => setShowSalaryModal(false)}
        financialYear={selectedFY}
      />

      <InvestmentModal
        isOpen={showInvestmentModal}
        onClose={() => { setShowInvestmentModal(false); setEditingInvestment(null); }}
        financialYear={selectedFY}
        investment={editingInvestment}
      />
    </div>
  );
}

function SalarySlipModal({
  isOpen,
  onClose,
  financialYear,
}: {
  isOpen: boolean;
  onClose: () => void;
  financialYear: string;
}) {
  const queryClient = useQueryClient();
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  const [parsing, setParsing] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  
  const [formData, setFormData] = useState({
    month: '',
    // Earnings
    basic: '',
    hra: '',
    lta: '',
    specialAllowance: '',
    otherAllowances: '',
    // Deductions
    pf: '',
    professionalTax: '',
    incomeTax: '',
    otherDeductions: '',
  });

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
    setShowAllFields(false);
  };

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

  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParseError(null);
    setParseSuccess(null);
    
    try {
      const parsed = await taxService.parseSalarySlip(file);
      
      setFormData({
        ...formData,
        basic: parsed.basic > 0 ? parsed.basic.toString() : '',
        hra: parsed.hra > 0 ? parsed.hra.toString() : '',
        lta: parsed.lta > 0 ? parsed.lta.toString() : '',
        specialAllowance: parsed.specialAllowance > 0 ? parsed.specialAllowance.toString() : '',
        otherAllowances: parsed.otherAllowances > 0 ? parsed.otherAllowances.toString() : '',
        pf: parsed.pf > 0 ? parsed.pf.toString() : '',
        professionalTax: parsed.professionalTax > 0 ? parsed.professionalTax.toString() : '',
        incomeTax: parsed.incomeTax > 0 ? parsed.incomeTax.toString() : '',
        otherDeductions: parsed.otherDeductions > 0 ? parsed.otherDeductions.toString() : '',
      });
      
      setParseSuccess(parsed.message || 'Salary slip parsed successfully! Please verify the values.');
      setEntryMode('manual');
      setShowAllFields(true);
    } catch (error: any) {
      setParseError(error.response?.data?.message || 'Failed to parse salary slip. Please enter values manually.');
      setEntryMode('manual');
    } finally {
      setParsing(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: () => taxService.addSalarySlip({
      financialYear,
      month: formData.month,
      grossIncome,
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
      netSalary,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-slips'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
      resetForm();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Salary Slip" size="full">
      <div className="space-y-4">
        {/* Entry Mode Toggle */}
        <div className="flex gap-1 p-1 bg-gray-700/50 rounded-lg">
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              entryMode === 'manual' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('upload')}
            className={`flex-1 py-2 px-3 sm:px-4 rounded-md text-xs sm:text-sm font-medium transition-colors ${
              entryMode === 'upload' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Upload Payslip
          </button>
        </div>

        {entryMode === 'upload' && (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 sm:p-8 text-center">
            <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-500 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-400 mb-2">Upload your salary slip (PDF)</p>
            <p className="text-xs text-gray-500 mb-4">We'll extract the earnings and deductions automatically</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="salary-upload"
              disabled={parsing}
            />
            <label 
              htmlFor="salary-upload"
              className={`inline-flex items-center justify-center px-4 py-2 font-medium rounded-lg transition-colors cursor-pointer ${
                parsing 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {parsing ? 'Parsing...' : 'Choose PDF File'}
            </label>
            <p className="text-xs text-gray-500 mt-4">Image upload (OCR) coming soon</p>
          </div>
        )}

        {parseSuccess && (
          <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm flex items-start gap-2">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {parseSuccess}
          </div>
        )}

        {parseError && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {parseError}
          </div>
        )}

        {entryMode === 'manual' && (
          <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
            <Select
              label="Month"
              options={[
                { value: '', label: 'Select month' },
                ...MONTHS.map(m => ({ value: m, label: m })),
              ]}
              value={formData.month}
              onChange={(value) => setFormData({ ...formData, month: value })}
            />

            {/* Earnings Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Earnings
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Basic Salary"
                  type="number"
                  value={formData.basic}
                  onChange={(e) => setFormData({ ...formData, basic: e.target.value })}
                  placeholder="e.g., 152400"
                  required
                />
                <Input
                  label="HRA (House Rent Allowance)"
                  type="number"
                  value={formData.hra}
                  onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                  placeholder="e.g., 76200"
                />
              </div>
              
              {showAllFields && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="LTA"
                    type="number"
                    value={formData.lta}
                    onChange={(e) => setFormData({ ...formData, lta: e.target.value })}
                    placeholder="e.g., 5000"
                  />
                  <Input
                    label="Special Allowance"
                    type="number"
                    value={formData.specialAllowance}
                    onChange={(e) => setFormData({ ...formData, specialAllowance: e.target.value })}
                    placeholder="e.g., 1500"
                  />
                </div>
              )}
              
              <Input
                label="Other Allowances (Books, Internet, Petrol, Food, Research etc.)"
                type="number"
                value={formData.otherAllowances}
                onChange={(e) => setFormData({ ...formData, otherAllowances: e.target.value })}
                placeholder="Total of all other allowances"
              />

              {!showAllFields && (
                <button
                  type="button"
                  onClick={() => setShowAllFields(true)}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  + Show more fields (LTA, Special Allowance)
                </button>
              )}
            </div>

            {/* Deductions Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Deductions
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="PF (Employee Contribution)"
                  type="number"
                  value={formData.pf}
                  onChange={(e) => setFormData({ ...formData, pf: e.target.value })}
                  placeholder="e.g., 18288"
                />
                <Input
                  label="Professional Tax"
                  type="number"
                  value={formData.professionalTax}
                  onChange={(e) => setFormData({ ...formData, professionalTax: e.target.value })}
                  placeholder="e.g., 300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Income Tax (TDS)"
                  type="number"
                  value={formData.incomeTax}
                  onChange={(e) => setFormData({ ...formData, incomeTax: e.target.value })}
                  placeholder="e.g., 38870"
                />
                <Input
                  label="Other Deductions (Labour Welfare, Food Ded etc.)"
                  type="number"
                  value={formData.otherDeductions}
                  onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                  placeholder="e.g., 2200"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-gray-700/50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Earnings (Gross)</span>
                <span className="text-green-400 font-medium">{formatCurrency(grossIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Deductions</span>
                <span className="text-red-400 font-medium">-{formatCurrency(totalDeductions)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-600">
                <span className="text-white font-medium">Net Salary</span>
                <span className="text-xl font-bold text-white">{formatCurrency(netSalary)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
              <Button type="submit" isLoading={addMutation.isPending} disabled={!formData.month || grossIncome === 0}>
                Add Salary Slip
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function InvestmentModal({
  isOpen,
  onClose,
  financialYear,
  investment,
}: {
  isOpen: boolean;
  onClose: () => void;
  financialYear: string;
  investment: Investment | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!investment;
  
  const [formData, setFormData] = useState({
    category: investment?.category || '80C',
    subCategory: investment?.subCategory || '',
    name: investment?.name || '',
    amount: investment?.amount.toString() || '',
    description: investment?.description || '',
  });

  React.useEffect(() => {
    if (investment) {
      setFormData({
        category: investment.category,
        subCategory: investment.subCategory || '',
        name: investment.name,
        amount: investment.amount.toString(),
        description: investment.description || '',
      });
    } else {
      setFormData({
        category: '80C',
        subCategory: '',
        name: '',
        amount: '',
        description: '',
      });
    }
  }, [investment]);

  const createMutation = useMutation({
    mutationFn: () => investmentService.create({
      ...formData,
      amount: parseFloat(formData.amount) || 0,
      financialYear,
      status: 'active',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => investmentService.update(investment!._id, {
      ...formData,
      amount: parseFloat(formData.amount) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => investmentService.delete(investment!._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['investments'] });
      queryClient.invalidateQueries({ queryKey: ['investment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tax-calculation'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Investment' : 'Add Investment'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Category"
          options={INVESTMENT_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          value={formData.category}
          onChange={(value) => setFormData({ ...formData, category: value as Investment['category'] })}
        />

        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., PPF, ELSS Mutual Fund, LIC Premium"
          required
        />

        <Input
          label="Sub-category (optional)"
          value={formData.subCategory}
          onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
          placeholder="e.g., SBI PPF, HDFC ELSS"
        />

        <Input
          label="Amount"
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          required
        />

        <Input
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        <div className="flex justify-between pt-4">
          <div>
            {isEditing && (
              <Button 
                variant="ghost" 
                type="button" 
                onClick={() => { if (confirm('Delete this investment?')) deleteMutation.mutate(); }}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {isEditing ? 'Save Changes' : 'Add Investment'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
