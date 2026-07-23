import { ScheduledWhatsAppMessage } from '../models/ScheduledWhatsAppMessage.js';
import { sendWhatsAppText } from './whatsapp.service.js';

let intervalHandle: NodeJS.Timeout | null = null;
let isProcessing = false;

async function processDueMessages(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();
    const dueMessages = await ScheduledWhatsAppMessage.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    })
      .sort({ scheduledAt: 1 })
      .limit(20);

    for (const msg of dueMessages) {
      msg.status = 'sending';
      await msg.save();

      try {
        await sendWhatsAppText(
          msg.userId.toString(),
          msg.recipientPhone,
          msg.message
        );
        msg.status = 'sent';
        msg.sentAt = new Date();
        msg.error = undefined;
        await msg.save();
        console.log(`[Scheduler] Sent message ${msg._id} to ${msg.recipientPhone}`);
      } catch (err) {
        msg.status = 'failed';
        msg.error = err instanceof Error ? err.message : 'Failed to send message';
        await msg.save();
        console.error(`[Scheduler] Failed message ${msg._id}:`, msg.error);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error processing due messages:', err);
  } finally {
    isProcessing = false;
  }
}

export function startMessageScheduler(intervalMs = 30000): void {
  if (intervalHandle) return;

  console.log(`[Scheduler] WhatsApp message scheduler started (every ${intervalMs / 1000}s)`);
  // Run once shortly after boot, then on interval
  setTimeout(() => {
    processDueMessages().catch(console.error);
  }, 5000);

  intervalHandle = setInterval(() => {
    processDueMessages().catch(console.error);
  }, intervalMs);
}

export function stopMessageScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
