import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/personal-finance',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },

  whatsapp: {
    sessionsDir: process.env.WHATSAPP_SESSIONS_DIR || './whatsapp-sessions',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  backup: {
    /** Directory for temporary/local backup archives */
    dir: process.env.BACKUP_DIR || './backups',
    /** Cron expression — default: 00:00 on the 1st of every month */
    cron: process.env.BACKUP_CRON || '0 0 1 * *',
    /** Set to "false" to disable the monthly backup job */
    enabled: process.env.BACKUP_ENABLED !== 'false',
    email: {
      to: process.env.BACKUP_EMAIL_TO || '',
      from: process.env.BACKUP_EMAIL_FROM || process.env.SMTP_USER || '',
      subject:
        process.env.BACKUP_EMAIL_SUBJECT || 'Personal Finance — Monthly Database Backup',
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
};
