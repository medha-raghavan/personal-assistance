import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { ScheduledWhatsAppMessage } from '../models/ScheduledWhatsAppMessage.js';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  isGroupJid,
  listWhatsAppGroups,
  normalizePhoneNumber,
  sendScheduledWhatsAppMessage,
} from '../services/whatsapp.service.js';

export async function getStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = getWhatsAppStatus(req.userId!);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function connect(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await connectWhatsApp(req.userId!);
    const status = getWhatsAppStatus(req.userId!);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
}

export async function disconnect(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await disconnectWhatsApp(req.userId!);
    res.json({
      success: true,
      data: {
        status: 'disconnected',
        qrDataUrl: null,
        phoneNumber: null,
        lastError: null,
        hasSavedSession: false,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listGroups(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const status = getWhatsAppStatus(req.userId!);
    if (status.status !== 'connected') {
      throw new ApiError(400, 'WhatsApp is not connected. Please scan the QR code first.');
    }

    const groups = await listWhatsAppGroups(req.userId!);
    res.json({ success: true, data: groups });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not connected')) {
      next(new ApiError(400, error.message));
      return;
    }
    next(error);
  }
}

export async function listMessages(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };

    if (status && typeof status === 'string' && status !== 'all') {
      filter.status = status;
    }

    const messages = await ScheduledWhatsAppMessage.find(filter)
      .sort({ scheduledAt: -1 })
      .limit(200);

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
}

function parseScheduledAt(scheduledAt: unknown, sendNow: boolean): Date {
  if (sendNow) {
    return new Date();
  }
  if (!scheduledAt) {
    throw new ApiError(400, 'scheduledAt is required unless sendNow is true');
  }
  const when = new Date(scheduledAt as string);
  if (Number.isNaN(when.getTime())) {
    throw new ApiError(400, 'Invalid scheduledAt date');
  }
  if (when.getTime() < Date.now() - 60_000) {
    throw new ApiError(400, 'Scheduled time must be in the future');
  }
  return when;
}

function validateMessageBody(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Message cannot be empty');
  }
  if (message.length > 4096) {
    throw new ApiError(400, 'Message is too long (max 4096 characters)');
  }
  return message.trim();
}

export async function createMessage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      recipientType = 'contact',
      recipientPhone,
      recipientJid,
      recipientName,
      message,
      scheduledAt,
      sendNow,
    } = req.body;

    if (recipientType !== 'contact' && recipientType !== 'group') {
      throw new ApiError(400, 'recipientType must be contact or group');
    }

    const trimmedMessage = validateMessageBody(message);
    const when = parseScheduledAt(scheduledAt, Boolean(sendNow));

    let phone: string | undefined;
    let jid: string | undefined;

    if (recipientType === 'group') {
      if (!recipientJid || typeof recipientJid !== 'string' || !isGroupJid(recipientJid.trim())) {
        throw new ApiError(400, 'A valid group is required (pick a group from your WhatsApp)');
      }
      jid = recipientJid.trim();
    } else {
      if (!recipientPhone) {
        throw new ApiError(400, 'Recipient phone and message are required');
      }
      phone = normalizePhoneNumber(recipientPhone);
      if (phone.length < 10 || phone.length > 15) {
        throw new ApiError(400, 'Enter a valid phone number with country code (e.g. 919876543210)');
      }
    }

    const doc = new ScheduledWhatsAppMessage({
      userId: req.userId,
      recipientType,
      recipientPhone: phone,
      recipientJid: jid,
      recipientName: recipientName?.trim() || undefined,
      message: trimmedMessage,
      scheduledAt: when,
      status: 'pending',
    });

    await doc.save();

    if (sendNow) {
      doc.status = 'sending';
      await doc.save();
      try {
        await sendScheduledWhatsAppMessage(req.userId!, {
          recipientType: doc.recipientType,
          recipientPhone: doc.recipientPhone,
          recipientJid: doc.recipientJid,
          message: doc.message,
        });
        doc.status = 'sent';
        doc.sentAt = new Date();
        doc.error = undefined;
        await doc.save();
      } catch (err) {
        doc.status = 'failed';
        doc.error = err instanceof Error ? err.message : 'Failed to send message';
        await doc.save();
      }
    }

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}

export async function cancelMessage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const message = await ScheduledWhatsAppMessage.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!message) {
      throw new ApiError(404, 'Scheduled message not found');
    }

    if (message.status !== 'pending') {
      throw new ApiError(400, 'Only pending messages can be cancelled');
    }

    message.status = 'cancelled';
    await message.save();

    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const message = await ScheduledWhatsAppMessage.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!message) {
      throw new ApiError(404, 'Scheduled message not found');
    }

    if (message.status === 'sending') {
      throw new ApiError(400, 'Cannot delete a message that is currently sending');
    }

    await message.deleteOne();

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function updateMessage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { recipientType, recipientPhone, recipientJid, recipientName, message, scheduledAt } =
      req.body;

    const doc = await ScheduledWhatsAppMessage.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!doc) {
      throw new ApiError(404, 'Scheduled message not found');
    }

    if (doc.status !== 'pending') {
      throw new ApiError(400, 'Only pending messages can be updated');
    }

    const nextType =
      recipientType === 'contact' || recipientType === 'group'
        ? recipientType
        : doc.recipientType || 'contact';

    if (recipientType !== undefined && recipientType !== 'contact' && recipientType !== 'group') {
      throw new ApiError(400, 'recipientType must be contact or group');
    }

    if (nextType === 'group') {
      const jid =
        recipientJid !== undefined
          ? String(recipientJid).trim()
          : doc.recipientJid;
      if (!jid || !isGroupJid(jid)) {
        throw new ApiError(400, 'A valid group is required (pick a group from your WhatsApp)');
      }
      doc.recipientType = 'group';
      doc.recipientJid = jid;
      doc.recipientPhone = undefined;
    } else {
      const phoneRaw = recipientPhone !== undefined ? recipientPhone : doc.recipientPhone;
      if (!phoneRaw) {
        throw new ApiError(400, 'Recipient phone is required');
      }
      const normalizedPhone = normalizePhoneNumber(String(phoneRaw));
      if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
        throw new ApiError(400, 'Enter a valid phone number with country code');
      }
      doc.recipientType = 'contact';
      doc.recipientPhone = normalizedPhone;
      doc.recipientJid = undefined;
    }

    if (recipientName !== undefined) {
      doc.recipientName = recipientName?.trim() || undefined;
    }

    if (message !== undefined) {
      doc.message = validateMessageBody(message);
    }

    if (scheduledAt !== undefined) {
      doc.scheduledAt = parseScheduledAt(scheduledAt, false);
    }

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}
