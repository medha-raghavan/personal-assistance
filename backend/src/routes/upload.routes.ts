import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  uploadStatement,
  getUploadPreview,
  confirmUpload,
  cancelUpload,
} from '../controllers/upload.controller.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../config/index.js';

const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
  ];
  
  const allowedExtensions = ['.csv', '.xls', '.xlsx', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: CSV, XLS, XLSX, PDF'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

const router = Router();

router.use(authenticate);

router.post('/statement', upload.single('file'), uploadStatement);
router.get('/preview/:uploadId', getUploadPreview);
router.post('/confirm/:uploadId', confirmUpload);
router.delete('/cancel/:uploadId', cancelUpload);

export default router;
