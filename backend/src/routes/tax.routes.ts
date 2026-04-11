import { Router } from 'express';
import multer from 'multer';
import {
  calculateTaxForFY,
  getSalarySlips,
  addSalarySlip,
  getTaxSlabs,
  parseSalarySlip,
} from '../controllers/tax.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

router.get('/calculate/:fy', calculateTaxForFY);
router.get('/salary-slips', getSalarySlips);
router.post('/salary-slip', addSalarySlip);
router.post('/parse-salary-slip', upload.single('file'), parseSalarySlip);
router.get('/slabs/:fy', getTaxSlabs);

export default router;
