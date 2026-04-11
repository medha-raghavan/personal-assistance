import { Router } from 'express';
import {
  getTrips,
  getTrip,
  createTrip,
  updateTrip,
  deleteTrip,
  addMember,
  removeMember,
  updateMember,
  getTripSummary,
  linkTransaction,
  unlinkTransaction,
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getBalances,
  getLinkedTransactions,
} from '../controllers/trip.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTrips);
router.post('/', createTrip);
router.get('/:id', getTrip);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);

router.post('/:id/members', addMember);
router.put('/:id/members/:memberId', updateMember);
router.delete('/:id/members/:memberId', removeMember);

router.get('/:id/summary', getTripSummary);
router.get('/:id/balances', getBalances);

router.get('/:id/expenses', getExpenses);
router.post('/:id/expenses', addExpense);
router.put('/:id/expenses/:expenseId', updateExpense);
router.delete('/:id/expenses/:expenseId', deleteExpense);

router.post('/:id/link-transaction/:txnId', linkTransaction);
router.delete('/:id/unlink-transaction/:txnId', unlinkTransaction);
router.get('/:id/linked-transactions', getLinkedTransactions);

export default router;
