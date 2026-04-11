import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  addKeyword,
  removeKeyword,
  matchCategory,
} from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', createCategory);
router.post('/match', matchCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);
router.post('/:id/keywords', addKeyword);
router.delete('/:id/keywords', removeKeyword);

export default router;
