import { Router } from 'express';
import {
  getOverview,
  getTrends,
  getCategoryBreakdown,
  getCalendarHeatmap,
  getSummary,
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/overview', getOverview);
router.get('/trends', getTrends);
router.get('/category-breakdown', getCategoryBreakdown);
router.get('/calendar-heatmap', getCalendarHeatmap);
router.get('/summary', getSummary);

export default router;
