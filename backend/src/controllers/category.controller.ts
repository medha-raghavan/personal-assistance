import { Response, NextFunction } from 'express';
import { Category, DEFAULT_CATEGORIES } from '../models/Category.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

export async function getCategories(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let categories = await Category.find({ userId: req.userId }).sort({ name: 1 });
    
    if (categories.length === 0) {
      const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        userId: req.userId,
        isDefault: true,
      }));
      categories = await Category.insertMany(defaultCats);
    }
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, icon, color, keywords } = req.body;
    
    const existingCategory = await Category.findOne({ userId: req.userId, name });
    if (existingCategory) {
      throw new ApiError(400, 'Category with this name already exists');
    }
    
    const category = new Category({
      userId: req.userId,
      name,
      icon,
      color,
      keywords: keywords || [],
      isDefault: false,
    });
    
    await category.save();
    
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, icon, color, keywords } = req.body;
    
    const category = await Category.findOne({ _id: id, userId: req.userId });
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ userId: req.userId, name });
      if (existingCategory) {
        throw new ApiError(400, 'Category with this name already exists');
      }
      category.name = name;
    }
    
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (keywords !== undefined) category.keywords = keywords;
    
    await category.save();
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    const category = await Category.findOne({ _id: id, userId: req.userId });
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    await category.deleteOne();
    
    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function addKeyword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    
    const category = await Category.findOne({ _id: id, userId: req.userId });
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (!category.keywords.includes(normalizedKeyword)) {
      category.keywords.push(normalizedKeyword);
      await category.save();
    }
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeKeyword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    
    const category = await Category.findOne({ _id: id, userId: req.userId });
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    const normalizedKeyword = keyword.toLowerCase().trim();
    category.keywords = category.keywords.filter(k => k !== normalizedKeyword);
    await category.save();
    
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

export async function matchCategory(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { description } = req.body;
    
    if (!description) {
      throw new ApiError(400, 'Description is required');
    }
    
    const categories = await Category.find({ userId: req.userId });
    const lowerDesc = description.toLowerCase();
    
    for (const category of categories) {
      for (const keyword of category.keywords) {
        if (lowerDesc.includes(keyword)) {
          res.json({
            success: true,
            data: {
              categoryId: category._id,
              categoryName: category.name,
              matchedKeyword: keyword,
            },
          });
          return;
        }
      }
    }
    
    const uncategorized = categories.find(c => c.name === 'Uncategorized');
    res.json({
      success: true,
      data: {
        categoryId: uncategorized?._id || null,
        categoryName: 'Uncategorized',
        matchedKeyword: null,
      },
    });
  } catch (error) {
    next(error);
  }
}
