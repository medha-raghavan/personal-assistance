import { Router } from 'express';
import {
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  getInvestmentSummary,
} from '../controllers/investment.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getInvestments);
router.post('/', createInvestment);
router.get('/summary/:fy', getInvestmentSummary);
router.put('/:id', updateInvestment);
router.delete('/:id', deleteInvestment);

export default router;
