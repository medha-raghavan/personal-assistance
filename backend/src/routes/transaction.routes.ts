import { Router } from 'express';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateTags,
  bulkUpdate,
  getCalendarData,
  getSummary,
} from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.post('/', createTransaction);
router.put('/bulk/tags', bulkUpdateTags);
router.put('/bulk/update', bulkUpdate);
router.get('/calendar/:year/:month', getCalendarData);
router.get('/summary', getSummary);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
