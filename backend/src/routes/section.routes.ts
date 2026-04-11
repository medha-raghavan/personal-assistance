import { Router } from 'express';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getSectionBalance,
} from '../controllers/section.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getSections);
router.post('/', createSection);
router.put('/:id', updateSection);
router.delete('/:id', deleteSection);
router.get('/:id/balance', getSectionBalance);

export default router;
