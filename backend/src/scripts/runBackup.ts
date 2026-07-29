/**
 * One-shot CLI to create a DB backup and email it.
 * Usage (from backend/): npm run backup:now
 */
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { runDatabaseBackupAndEmail } from '../services/backup.service.js';

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const result = await runDatabaseBackupAndEmail({ keepLocalCopy: true });
    console.log(
      `Backup ready: ${result.fileName} (${result.sizeBytes} bytes)` +
        (result.emailedTo ? ` emailed to ${result.emailedTo}` : '')
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Backup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
