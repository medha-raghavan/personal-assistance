import { Router } from 'express';
import {
  completeTask,
  createNote,
  disconnect,
  getAuthUrl,
  getStatus,
  oauthCallback,
  updateNote,
  weekDashboard,
} from '../controllers/ticktick.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public OAuth callback — browser redirect has no JWT
router.get('/callback', oauthCallback);

router.use(authenticate);

router.get('/status', getStatus);
router.get('/auth-url', getAuthUrl);
router.post('/disconnect', disconnect);
router.get('/week-dashboard', weekDashboard);
router.post('/notes', createNote);
router.put('/notes/:projectId/:taskId', updateNote);
router.post('/tasks/:projectId/:taskId/complete', completeTask);

export default router;
