import { Router } from 'express';
import {
  getStatus,
  connect,
  disconnect,
  listMessages,
  createMessage,
  cancelMessage,
  deleteMessage,
  updateMessage,
} from '../controllers/whatsapp.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/status', getStatus);
router.post('/connect', connect);
router.post('/disconnect', disconnect);

router.get('/messages', listMessages);
router.post('/messages', createMessage);
router.put('/messages/:id', updateMessage);
router.post('/messages/:id/cancel', cancelMessage);
router.delete('/messages/:id', deleteMessage);

export default router;
