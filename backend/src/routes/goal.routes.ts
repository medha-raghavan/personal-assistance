import { Router } from 'express';
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
} from '../controllers/goal.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getGoals);
router.post('/', createGoal);
router.get('/:id', getGoalById);
router.patch('/:id', updateGoal);
router.delete('/:id', deleteGoal);

export default router;
