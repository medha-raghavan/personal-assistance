import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import { Section } from '../models/Section.js';
import { Transaction } from '../models/Transaction.js';
import { UploadSession, IParsedTransaction } from '../models/UploadSession.js';
import { Category, DEFAULT_CATEGORIES } from '../models/Category.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';
import { HDFCParser } from '../services/parsers/hdfc.parser.js';
import { HDFCXLSParser } from '../services/parsers/hdfc-xls.parser.js';
import { ICICIParser } from '../services/parsers/icici.parser.js';
import { config } from '../config/index.js';

function toLocalDayKey(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function amountKey(amount: number): string {
  return Number(amount).toFixed(2);
}

function softMatchKey(date: Date | string, amount: number): string {
  return `${toLocalDayKey(date)}_${amountKey(amount)}`;
}

async function matchCategoryForDescription(userId: string, description: string): Promise<string | null> {
  let categories = await Category.find({ userId });
  
  if (categories.length === 0) {
    const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      userId: new mongoose.Types.ObjectId(userId),
      isDefault: true,
    }));
    categories = await Category.insertMany(defaultCats);
  }
  
  const lowerDesc = description.toLowerCase();
  
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (lowerDesc.includes(keyword)) {
        return category._id.toString();
      }
    }
  }
  
  const uncategorized = categories.find(c => c.name === 'Uncategorized');
  return uncategorized?._id.toString() || null;
}

export async function uploadStatement(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sectionId } = req.body;
    const file = req.file;

    if (!file) {
      throw new ApiError(400, 'No file uploaded');
    }

    if (!sectionId) {
      throw new ApiError(400, 'Section ID is required');
    }

    const section = await Section.findOne({ _id: sectionId, userId: req.userId });
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    if (!section.uploadEnabled) {
      throw new ApiError(400, 'Upload is not enabled for this section');
    }

    const uploadSession = new UploadSession({
      userId: req.userId,
      sectionId,
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
      status: 'pending',
    });

    await uploadSession.save();

    let parser;
    const fileExt = path.extname(file.originalname).toLowerCase();

    // Always determine parser from file extension for best compatibility
    if (fileExt === '.csv') {
      parser = new HDFCParser(section.name);
    } else if (fileExt === '.xls' || fileExt === '.xlsx') {
      parser = new HDFCXLSParser(section.name);
    } else if (fileExt === '.pdf') {
      parser = new ICICIParser(section.name);
    } else {
      throw new ApiError(400, `Unsupported file format: ${fileExt}. Supported formats: .csv, .xls, .xlsx, .pdf`);
    }

    console.log(`Parsing file: ${file.originalname}, extension: ${fileExt}, parser: ${parser.constructor.name}`);

    const fileContent = await fs.readFile(file.path);
    const parseResult = await parser.parse(fileContent, file.originalname);

    if (!parseResult.success) {
      uploadSession.status = 'failed';
      uploadSession.errorMessage = parseResult.errors.join('; ');
      await uploadSession.save();
      throw new ApiError(400, `Parse failed: ${parseResult.errors.join('; ')}`);
    }

    const compositeKeys = parseResult.transactions.map(t => t.compositeKey);
    const existingByKey = await Transaction.find({
      userId: req.userId,
      compositeKey: { $in: compositeKeys },
    }).select('compositeKey');

    const existingKeys = new Set(existingByKey.map(t => t.compositeKey));

    // Soft matches: same calendar day + amount in this section (e.g. SMS vs statement narration)
    const parsedDates = parseResult.transactions
      .map((t) => new Date(t.transactionDate))
      .filter((d) => !Number.isNaN(d.getTime()));
    const softMatchKeys = new Set<string>();
    if (parsedDates.length > 0) {
      const minDate = new Date(Math.min(...parsedDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...parsedDates.map((d) => d.getTime())));
      minDate.setHours(0, 0, 0, 0);
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setHours(23, 59, 59, 999);
      maxDate.setDate(maxDate.getDate() + 1);

      const sectionCandidates = await Transaction.find({
        userId: req.userId,
        sectionId: uploadSession.sectionId,
        transactionDate: { $gte: minDate, $lte: maxDate },
      }).select('transactionDate amount');

      for (const existing of sectionCandidates) {
        softMatchKeys.add(softMatchKey(existing.transactionDate, existing.amount));
      }
    }

    let categories = await Category.find({ userId: req.userId });
    if (categories.length === 0) {
      const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        userId: new mongoose.Types.ObjectId(req.userId),
        isDefault: true,
      }));
      categories = await Category.insertMany(defaultCats);
    }

    const transactions = await Promise.all(parseResult.transactions.map(async t => {
      const lowerDesc = t.description.toLowerCase();
      let matchedCategory = categories.find(c => c.name === 'Uncategorized');
      let matchedKeyword: string | null = null;
      
      for (const category of categories) {
        for (const keyword of category.keywords) {
          if (lowerDesc.includes(keyword)) {
            matchedCategory = category;
            matchedKeyword = keyword;
            break;
          }
        }
        if (matchedCategory && matchedCategory.name !== 'Uncategorized') break;
      }
      
      const tags = [...(t.tags || [])];
      if (matchedKeyword && !tags.includes(matchedKeyword)) {
        tags.push(matchedKeyword);
      }

      const isDuplicate = existingKeys.has(t.compositeKey);
      const isPossibleDuplicate =
        !isDuplicate && softMatchKeys.has(softMatchKey(t.transactionDate, t.amount));
      
      return {
        ...t,
        tags,
        isDuplicate,
        isPossibleDuplicate,
        categoryId: matchedCategory?._id.toString(),
        categoryName: matchedCategory?.name,
      };
    }));

    // Store parsed transactions in a JSON file instead of database
    const parsedDataPath = file.path + '.parsed.json';
    await fs.writeFile(parsedDataPath, JSON.stringify(transactions));

    uploadSession.parsedDataPath = parsedDataPath;
    uploadSession.totalCount = transactions.length;
    uploadSession.duplicateCount = transactions.filter(t => t.isDuplicate).length;
    uploadSession.newCount = transactions.filter(t => !t.isDuplicate).length;
    uploadSession.status = 'previewing';
    await uploadSession.save();

    const possibleDuplicateCount = transactions.filter(t => t.isPossibleDuplicate).length;

    res.json({
      success: true,
      data: {
        uploadId: uploadSession._id,
        fileName: file.originalname,
        totalCount: uploadSession.totalCount,
        duplicateCount: uploadSession.duplicateCount,
        possibleDuplicateCount,
        newCount: uploadSession.newCount,
        parseErrors: parseResult.errors,
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUploadPreview(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      _id: uploadId,
      userId: req.userId,
    }).populate('sectionId', 'name label');

    if (!session) {
      throw new ApiError(404, 'Upload session not found');
    }

    if (session.status === 'expired') {
      throw new ApiError(400, 'Upload session has expired');
    }

    // Read parsed transactions from JSON file
    let transactions = [];
    if (session.parsedDataPath) {
      try {
        const data = await fs.readFile(session.parsedDataPath, 'utf-8');
        transactions = JSON.parse(data);
      } catch {
        console.error('Failed to read parsed data file');
      }
    }

    res.json({
      success: true,
      data: {
        uploadId: session._id,
        fileName: session.fileName,
        section: session.sectionId,
        status: session.status,
        totalCount: session.totalCount,
        duplicateCount: session.duplicateCount,
        possibleDuplicateCount: transactions.filter(
          (t: IParsedTransaction) => t.isPossibleDuplicate
        ).length,
        newCount: session.newCount,
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmUpload(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { uploadId } = req.params;
    const { skipDuplicates = true, selectedTransactions, categoryUpdates } = req.body;

    const session = await UploadSession.findOne({
      _id: uploadId,
      userId: req.userId,
      status: 'previewing',
    });

    if (!session) {
      throw new ApiError(404, 'Upload session not found or already processed');
    }

    const section = await Section.findById(session.sectionId);
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    // Read parsed transactions from JSON file
    let parsedTransactions: IParsedTransaction[] = [];
    if (session.parsedDataPath) {
      try {
        const data = await fs.readFile(session.parsedDataPath, 'utf-8');
        parsedTransactions = JSON.parse(data);
      } catch {
        throw new ApiError(400, 'Parsed data not found. Please re-upload the file.');
      }
    }

    let transactionsToInsert = parsedTransactions;

    if (skipDuplicates) {
      transactionsToInsert = transactionsToInsert.filter(t => !t.isDuplicate);
    }

    if (selectedTransactions && Array.isArray(selectedTransactions)) {
      const selectedKeys = new Set(selectedTransactions);
      transactionsToInsert = transactionsToInsert.filter(t => 
        selectedKeys.has(t.compositeKey)
      );
    }

    const categoryUpdateMap: Record<string, string> = categoryUpdates || {};

    const transactionDocs = transactionsToInsert.map(t => {
      const updatedCategoryId = categoryUpdateMap[t.compositeKey] || t.categoryId;
      return {
        sectionId: session.sectionId,
        userId: session.userId,
        uploadSessionId: session._id,
        transactionDate: t.transactionDate,
        valueDate: t.valueDate,
        amount: t.amount,
        type: t.type,
        description: t.description,
        reference: t.reference,
        tags: t.tags,
        categoryId: updatedCategoryId ? new mongoose.Types.ObjectId(updatedCategoryId) : undefined,
        currency: 'INR',
        exchangeRate: 1,
        compositeKey: t.compositeKey,
      };
    });

    if (transactionDocs.length > 0) {
      await Transaction.insertMany(transactionDocs, { ordered: false }).catch(err => {
        console.error('Bulk insert error:', err);
      });

      const totalCredit = transactionDocs
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalDebit = transactionDocs
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0);

      section.balance += totalCredit - totalDebit;
      await section.save();
    }

    session.status = 'confirmed';
    await session.save();

    // Clean up temporary files
    try {
      await fs.unlink(session.filePath);
    } catch {
      // Ignore file not found
    }
    try {
      if (session.parsedDataPath) {
        await fs.unlink(session.parsedDataPath);
      }
    } catch {
      // Ignore file not found
    }

    res.json({
      success: true,
      data: {
        importedCount: transactionDocs.length,
        skippedDuplicates: session.duplicateCount,
        newBalance: section.balance,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelUpload(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { uploadId } = req.params;

    const session = await UploadSession.findOne({
      _id: uploadId,
      userId: req.userId,
    });

    if (!session) {
      throw new ApiError(404, 'Upload session not found');
    }

    // Clean up files
    try {
      await fs.unlink(session.filePath);
    } catch {
      // Ignore
    }
    try {
      if (session.parsedDataPath) {
        await fs.unlink(session.parsedDataPath);
      }
    } catch {
      // Ignore
    }

    await session.deleteOne();

    res.json({
      success: true,
      message: 'Upload cancelled',
    });
  } catch (error) {
    next(error);
  }
}
