import { Router } from 'express';
import {
  getStatus,
  getAuthUrl,
  oauthCallback,
  disconnect,
  listContacts,
} from '../controllers/google.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Public OAuth callback — browser redirect has no JWT
router.get('/callback', oauthCallback);

router.use(authenticate);

router.get('/status', getStatus);
router.get('/auth-url', getAuthUrl);
router.post('/disconnect', disconnect);
router.get('/contacts', listContacts);

export default router;
