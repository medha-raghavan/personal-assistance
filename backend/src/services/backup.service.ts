import fs from 'fs/promises';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

export interface BackupResult {
  archivePath: string;
  fileName: string;
  collectionCount: number;
  documentCount: number;
  sizeBytes: number;
  emailedTo?: string;
}

function timestampLabel(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function getDatabaseName(): string {
  const db = mongoose.connection.db;
  if (db) return db.databaseName;

  try {
    const uri = new URL(config.mongodb.uri);
    const name = uri.pathname.replace(/^\//, '');
    return name || 'personal-finance';
  } catch {
    return 'personal-finance';
  }
}

async function ensureBackupDir(): Promise<string> {
  const dir = path.resolve(config.backup.dir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Export every collection in the connected MongoDB database to a single
 * JSON document, then gzip it for email-friendly transfer.
 */
export async function createDatabaseBackup(): Promise<BackupResult> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB is not connected — cannot create backup');
  }

  const backupDir = await ensureBackupDir();
  const stamp = timestampLabel();
  const dbName = getDatabaseName();
  const jsonName = `${dbName}-backup-${stamp}.json`;
  const gzipName = `${jsonName}.gz`;
  const jsonPath = path.join(backupDir, jsonName);
  const archivePath = path.join(backupDir, gzipName);

  const collections = await db.listCollections().toArray();
  const payload: {
    database: string;
    createdAt: string;
    collections: Record<string, unknown[]>;
  } = {
    database: dbName,
    createdAt: new Date().toISOString(),
    collections: {},
  };

  let documentCount = 0;

  for (const { name } of collections) {
    // Skip system collections
    if (name.startsWith('system.')) continue;

    const docs = await db.collection(name).find({}).toArray();
    payload.collections[name] = docs;
    documentCount += docs.length;
  }

  const collectionCount = Object.keys(payload.collections).length;

  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  await pipeline(
    createReadStream(jsonPath),
    createGzip({ level: 9 }),
    createWriteStream(archivePath)
  );

  // Remove the uncompressed JSON to save disk space
  await fs.unlink(jsonPath).catch(() => undefined);

  const stats = await fs.stat(archivePath);

  console.log(
    `[Backup] Created ${gzipName} (${collectionCount} collections, ${documentCount} documents, ${stats.size} bytes)`
  );

  return {
    archivePath,
    fileName: gzipName,
    collectionCount,
    documentCount,
    sizeBytes: stats.size,
  };
}

function assertSmtpConfigured(): void {
  const { host, user, pass } = config.backup.smtp;
  const { to, from } = config.backup.email;

  const missing: string[] = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');
  if (!to) missing.push('BACKUP_EMAIL_TO');
  if (!from) missing.push('BACKUP_EMAIL_FROM (or SMTP_USER)');

  if (missing.length > 0) {
    throw new Error(
      `Backup email is not configured. Missing: ${missing.join(', ')}`
    );
  }
}

export async function sendBackupEmail(backup: BackupResult): Promise<string> {
  assertSmtpConfigured();

  const { smtp, email } = config.backup;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const sizeKb = (backup.sizeBytes / 1024).toFixed(1);
  const createdAt = new Date().toISOString();

  await transporter.sendMail({
    from: email.from,
    to: email.to,
    subject: email.subject,
    text: [
      'Personal Finance Tracker — monthly database backup',
      '',
      `Created at: ${createdAt}`,
      `Database:   ${getDatabaseName()}`,
      `Collections: ${backup.collectionCount}`,
      `Documents:  ${backup.documentCount}`,
      `Archive:    ${backup.fileName} (${sizeKb} KB)`,
      '',
      'The gzipped JSON dump is attached. To restore:',
      '  1. gunzip the attachment',
      '  2. Import each collection from the JSON "collections" object',
      '     (e.g. with mongoimport or a restore script).',
    ].join('\n'),
    attachments: [
      {
        filename: backup.fileName,
        path: backup.archivePath,
        contentType: 'application/gzip',
      },
    ],
  });

  console.log(`[Backup] Email sent to ${email.to}`);
  return email.to;
}

/**
 * Create a full DB backup and email the gzipped archive.
 * Optionally deletes the local archive after a successful send.
 */
export async function runDatabaseBackupAndEmail(
  options: { keepLocalCopy?: boolean } = {}
): Promise<BackupResult> {
  const keepLocalCopy = options.keepLocalCopy ?? true;
  const backup = await createDatabaseBackup();
  const emailedTo = await sendBackupEmail(backup);

  if (!keepLocalCopy) {
    await fs.unlink(backup.archivePath).catch(() => undefined);
  }

  return { ...backup, emailedTo };
}
