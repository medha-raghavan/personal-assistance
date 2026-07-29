import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config/index.js';
import { runDatabaseBackupAndEmail } from './backup.service.js';

let task: ScheduledTask | null = null;
let isRunning = false;

async function executeBackupJob(): Promise<void> {
  if (isRunning) {
    console.log('[BackupScheduler] Previous backup still running — skipping');
    return;
  }

  isRunning = true;
  console.log('[BackupScheduler] Starting monthly database backup…');

  try {
    const result = await runDatabaseBackupAndEmail({ keepLocalCopy: true });
    console.log(
      `[BackupScheduler] Backup complete: ${result.fileName} → ${result.emailedTo}`
    );
  } catch (err) {
    console.error(
      '[BackupScheduler] Backup failed:',
      err instanceof Error ? err.message : err
    );
  } finally {
    isRunning = false;
  }
}

/**
 * Schedule a monthly (by default) database backup that emails a gzipped dump.
 * Cron expression is configurable via BACKUP_CRON (default: `0 0 1 * *`).
 */
export function startBackupScheduler(): void {
  if (task) return;

  if (!config.backup.enabled) {
    console.log('[BackupScheduler] Disabled (BACKUP_ENABLED=false)');
    return;
  }

  if (!cron.validate(config.backup.cron)) {
    console.error(
      `[BackupScheduler] Invalid BACKUP_CRON expression: "${config.backup.cron}"`
    );
    return;
  }

  const { host, user, pass } = config.backup.smtp;
  const { to } = config.backup.email;
  if (!host || !user || !pass || !to) {
    console.warn(
      '[BackupScheduler] SMTP / BACKUP_EMAIL_TO not fully configured — ' +
        'scheduler is armed but the job will fail until credentials are set'
    );
  }

  task = cron.schedule(config.backup.cron, () => {
    executeBackupJob().catch(console.error);
  });

  console.log(
    `[BackupScheduler] Monthly DB backup scheduled (cron: "${config.backup.cron}")`
  );
}

export function stopBackupScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}

/** Manual trigger — useful for testing or an admin endpoint later. */
export async function triggerBackupNow(): Promise<void> {
  await executeBackupJob();
}
