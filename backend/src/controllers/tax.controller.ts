import { Response, NextFunction } from 'express';
import pdfParse from 'pdf-parse';
import { SalarySlip } from '../models/SalarySlip.js';
import { Investment } from '../models/Investment.js';
import { TaxSlab, ITaxSlabEntry } from '../models/TaxSlab.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import { getFinancialYear } from '../utils/helpers.js';

const DEFAULT_TAX_SLABS = {
  'FY25-26': {
    new: {
      slabs: [
        { minAmount: 0, maxAmount: 400000, rate: 0 },
        { minAmount: 400000, maxAmount: 800000, rate: 5 },
        { minAmount: 800000, maxAmount: 1200000, rate: 10 },
        { minAmount: 1200000, maxAmount: 1600000, rate: 15 },
        { minAmount: 1600000, maxAmount: 2000000, rate: 20 },
        { minAmount: 2000000, maxAmount: 2400000, rate: 25 },
        { minAmount: 2400000, maxAmount: null, rate: 30 },
      ],
      standardDeduction: 75000,
      rebateLimit: 700000,
      rebateAmount: 25000,
    },
    old: {
      slabs: [
        { minAmount: 0, maxAmount: 250000, rate: 0 },
        { minAmount: 250000, maxAmount: 500000, rate: 5 },
        { minAmount: 500000, maxAmount: 1000000, rate: 20 },
        { minAmount: 1000000, maxAmount: null, rate: 30 },
      ],
      standardDeduction: 50000,
      rebateLimit: 500000,
      rebateAmount: 12500,
    },
  },
};

function calculateTax(
  taxableIncome: number,
  slabs: ITaxSlabEntry[],
  rebateLimit: number,
  rebateAmount: number
): { tax: number; breakdown: Array<{ slab: string; tax: number }> } {
  let tax = 0;
  const breakdown: Array<{ slab: string; tax: number }> = [];

  for (const slab of slabs) {
    const maxAmount = slab.maxAmount ?? Infinity;
    
    if (taxableIncome > slab.minAmount) {
      const taxableInSlab = Math.min(taxableIncome, maxAmount) - slab.minAmount;
      const slabTax = (taxableInSlab * slab.rate) / 100;
      tax += slabTax;
      
      if (slabTax > 0) {
        breakdown.push({
          slab: `${slab.minAmount.toLocaleString()} - ${maxAmount === Infinity ? 'Above' : maxAmount.toLocaleString()} @ ${slab.rate}%`,
          tax: slabTax,
        });
      }
    }
  }

  if (taxableIncome <= rebateLimit && tax <= rebateAmount) {
    breakdown.push({ slab: 'Rebate u/s 87A', tax: -tax });
    tax = 0;
  }

  const cess = tax * 0.04;
  if (cess > 0) {
    breakdown.push({ slab: 'Health & Education Cess @ 4%', tax: cess });
    tax += cess;
  }

  return { tax: Math.round(tax), breakdown };
}

export async function calculateTaxForFY(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fy } = req.params;
    
    const salarySlips = await SalarySlip.find({
      userId: req.userId,
      financialYear: fy,
    });

    const investments = await Investment.find({
      userId: req.userId,
      financialYear: fy,
      status: 'active',
    });

    const totalGrossIncome = salarySlips.reduce((sum, slip) => sum + slip.grossIncome, 0);
    const totalPF = salarySlips.reduce((sum, slip) => sum + (slip.deductions?.pf || 0), 0);

    const deductions80C = investments
      .filter(i => i.category === '80C')
      .reduce((sum, i) => sum + i.amount, 0) + totalPF;
    const capped80C = Math.min(deductions80C, 150000);

    const deductions80D = investments
      .filter(i => i.category === '80D')
      .reduce((sum, i) => sum + i.amount, 0);
    const capped80D = Math.min(deductions80D, 25000);

    const deductions80CCD = investments
      .filter(i => i.category === '80CCD' || i.category === 'NPS')
      .reduce((sum, i) => sum + i.amount, 0);
    const capped80CCD = Math.min(deductions80CCD, 50000);

    const fyKey = fy.replace('FY', 'FY').replace(/-/g, '-') as keyof typeof DEFAULT_TAX_SLABS;
    const taxSlabs = DEFAULT_TAX_SLABS['FY25-26'];

    const newRegimeIncome = totalGrossIncome - taxSlabs.new.standardDeduction;
    const newRegimeTax = calculateTax(
      newRegimeIncome,
      taxSlabs.new.slabs,
      taxSlabs.new.rebateLimit,
      taxSlabs.new.rebateAmount
    );

    const totalOldDeductions = taxSlabs.old.standardDeduction + capped80C + capped80D + capped80CCD;
    const oldRegimeIncome = totalGrossIncome - totalOldDeductions;
    const oldRegimeTax = calculateTax(
      oldRegimeIncome,
      taxSlabs.old.slabs,
      taxSlabs.old.rebateLimit,
      taxSlabs.old.rebateAmount
    );

    const recommendation = newRegimeTax.tax <= oldRegimeTax.tax ? 'new' : 'old';
    const savings = Math.abs(newRegimeTax.tax - oldRegimeTax.tax);

    res.json({
      success: true,
      data: {
        financialYear: fy,
        grossIncome: totalGrossIncome,
        newRegime: {
          standardDeduction: taxSlabs.new.standardDeduction,
          taxableIncome: newRegimeIncome,
          ...newRegimeTax,
        },
        oldRegime: {
          standardDeduction: taxSlabs.old.standardDeduction,
          deductions: {
            '80C': capped80C,
            '80D': capped80D,
            '80CCD': capped80CCD,
            total: totalOldDeductions,
          },
          taxableIncome: oldRegimeIncome,
          ...oldRegimeTax,
        },
        recommendation,
        potentialSavings: savings,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getSalarySlips(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fy } = req.query;
    
    const filter: Record<string, unknown> = { userId: req.userId };
    if (fy) filter.financialYear = fy;
    
    const slips = await SalarySlip.find(filter).sort({ uploadDate: -1 });
    
    res.json({
      success: true,
      data: slips,
    });
  } catch (error) {
    next(error);
  }
}

export async function addSalarySlip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      financialYear,
      month,
      grossIncome,
      basicSalary,
      hra,
      specialAllowance,
      otherAllowances,
      deductions,
      netSalary,
    } = req.body;

    const slip = new SalarySlip({
      userId: req.userId,
      financialYear: financialYear || getFinancialYear(new Date()),
      month,
      grossIncome,
      basicSalary,
      hra,
      specialAllowance,
      otherAllowances,
      deductions,
      netSalary,
    });

    await slip.save();

    res.status(201).json({
      success: true,
      data: slip,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTaxSlabs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { fy } = req.params;
    
    let slabs = await TaxSlab.find({ financialYear: fy });
    
    if (slabs.length === 0) {
      const defaultSlabs = DEFAULT_TAX_SLABS['FY25-26'];
      slabs = [
        {
          financialYear: fy,
          regime: 'new',
          ...defaultSlabs.new,
          cessRate: 4,
        },
        {
          financialYear: fy,
          regime: 'old',
          ...defaultSlabs.old,
          cessRate: 4,
        },
      ] as any;
    }
    
    res.json({
      success: true,
      data: slabs,
    });
  } catch (error) {
    next(error);
  }
}

interface ParsedSalarySlip {
  basic: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  otherAllowances: number;
  grossIncome: number;
  pf: number;
  professionalTax: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  rawText?: string;
}

function parseAmount(text: string): number {
  const cleaned = text.replace(/,/g, '').replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

function findAmountAfterLabel(text: string, label: RegExp): number {
  const match = text.match(label);
  if (!match) return 0;
  
  const afterLabel = text.substring(match.index! + match[0].length);
  const amountMatch = afterLabel.match(/^\s*:?\s*([0-9,]+\.?\d*)/);
  if (amountMatch) {
    return parseAmount(amountMatch[1]);
  }
  return 0;
}

function findAmountInLine(line: string): number {
  const amounts = line.match(/[0-9,]+\.\d{2}/g);
  if (amounts && amounts.length > 0) {
    for (const amt of amounts) {
      const val = parseAmount(amt);
      if (val > 0) return val;
    }
  }
  return 0;
}

function extractSalaryComponents(text: string): ParsedSalarySlip {
  const result: ParsedSalarySlip = {
    basic: 0,
    hra: 0,
    lta: 0,
    specialAllowance: 0,
    otherAllowances: 0,
    grossIncome: 0,
    pf: 0,
    professionalTax: 0,
    incomeTax: 0,
    otherDeductions: 0,
    totalDeductions: 0,
    netSalary: 0,
    rawText: text,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = text.toLowerCase();

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const amount = findAmountInLine(line);
    
    if (amount > 0) {
      if (/^basic[^a-z]/i.test(lowerLine) || /\bbasic\s*(salary)?\b/i.test(lowerLine)) {
        if (!lowerLine.includes('basic_a') && result.basic === 0) {
          result.basic = amount;
        }
      }
      else if (/house\s*rent\s*allowance/i.test(lowerLine) || /\bhra\b/i.test(lowerLine)) {
        if (!lowerLine.includes('_a') && result.hra === 0) {
          result.hra = amount;
        }
      }
      else if (/\blta\b/i.test(lowerLine) || /leave\s*travel/i.test(lowerLine)) {
        if (result.lta === 0) {
          result.lta = amount;
        }
      }
      else if (/special\s*allowance/i.test(lowerLine)) {
        if (!lowerLine.includes('_a') && result.specialAllowance === 0) {
          result.specialAllowance = amount;
        }
      }
      else if (/profession\s*tax/i.test(lowerLine) || /professional\s*tax/i.test(lowerLine) || /\bpt\b/i.test(lowerLine)) {
        if (result.professionalTax === 0) {
          result.professionalTax = amount;
        }
      }
      else if (/income\s*tax/i.test(lowerLine) || /\bincome\s?tax\b/i.test(lowerLine) || /\btds\b/i.test(lowerLine)) {
        if (result.incomeTax === 0) {
          result.incomeTax = amount;
        }
      }
      else if (/provident\s*fund/i.test(lowerLine) || /\bpf\b/i.test(lowerLine) || /\bepf\b/i.test(lowerLine)) {
        if (result.pf === 0) {
          result.pf = amount;
        }
      }
      else if (/books|periodical/i.test(lowerLine)) {
        result.otherAllowances += amount;
      }
      else if (/internet|mobile/i.test(lowerLine)) {
        result.otherAllowances += amount;
      }
      else if (/research\s*allowance/i.test(lowerLine)) {
        result.otherAllowances += amount;
      }
      else if (/petrol|fuel/i.test(lowerLine)) {
        result.otherAllowances += amount;
      }
      else if (/food\s*allowance(?!\s*ded)/i.test(lowerLine) && !/ded/i.test(lowerLine)) {
        result.otherAllowances += amount;
      }
      else if (/food\s*allowance\s*ded/i.test(lowerLine) || /food\s*ded/i.test(lowerLine)) {
        result.otherDeductions += amount;
      }
      else if (/labour\s*welfare/i.test(lowerLine) || /\blwf\b/i.test(lowerLine)) {
        result.otherDeductions += amount;
      }
    }
  }

  const grossPatterns = [
    /gross\s*(?:salary|earning|pay|income)\s*[:\s]*([0-9,]+\.?\d*)/i,
    /total\s*earning[s]?\s*[:\s]*([0-9,]+\.?\d*)/i,
  ];
  
  for (const pattern of grossPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = parseAmount(match[1]);
      if (val > result.grossIncome) {
        result.grossIncome = val;
      }
    }
  }

  if (result.grossIncome === 0) {
    result.grossIncome = result.basic + result.hra + result.lta + result.specialAllowance + result.otherAllowances;
  }

  result.totalDeductions = result.pf + result.professionalTax + result.incomeTax + result.otherDeductions;

  const netPatterns = [
    /net\s*(?:salary|pay)\s*[:\s]*([0-9,]+\.?\d*)/i,
    /take\s*home\s*[:\s]*([0-9,]+\.?\d*)/i,
  ];
  
  for (const pattern of netPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = parseAmount(match[1]);
      if (val > 0) {
        result.netSalary = val;
        break;
      }
    }
  }

  if (result.netSalary === 0) {
    result.netSalary = result.grossIncome - result.totalDeductions;
  }

  return result;
}

export async function parseSalarySlip(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    let text = '';
    
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      text = pdfData.text;
    } else {
      throw new ApiError(400, 'Only PDF files are supported for now. Image OCR coming soon.');
    }

    const parsed = extractSalaryComponents(text);

    const detectedFields: string[] = [];
    if (parsed.basic > 0) detectedFields.push('Basic');
    if (parsed.hra > 0) detectedFields.push('HRA');
    if (parsed.lta > 0) detectedFields.push('LTA');
    if (parsed.specialAllowance > 0) detectedFields.push('Special Allowance');
    if (parsed.otherAllowances > 0) detectedFields.push('Other Allowances');
    if (parsed.pf > 0) detectedFields.push('PF');
    if (parsed.professionalTax > 0) detectedFields.push('Professional Tax');
    if (parsed.incomeTax > 0) detectedFields.push('Income Tax');
    if (parsed.otherDeductions > 0) detectedFields.push('Other Deductions');

    res.json({
      success: true,
      data: {
        ...parsed,
        rawText: undefined,
        detectedFields,
        message: detectedFields.length > 0 
          ? `Detected: ${detectedFields.join(', ')}. Please verify the values.`
          : 'Could not automatically detect values. Please fill in the fields manually.',
      },
    });
  } catch (error) {
    next(error);
  }
}
