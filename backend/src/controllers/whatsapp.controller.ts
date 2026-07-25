import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { ScheduledWhatsAppMessage } from '../models/ScheduledWhatsAppMessage.js';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
  normalizePhoneNumber,
  sendWhatsAppText,
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

export async function createMessage(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { recipientPhone, recipientName, message, scheduledAt, sendNow } = req.body;

    if (!recipientPhone || !message) {
      throw new ApiError(400, 'Recipient phone and message are required');
    }

    const normalizedPhone = normalizePhoneNumber(recipientPhone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      throw new ApiError(400, 'Enter a valid phone number with country code (e.g. 919876543210)');
    }

    if (typeof message !== 'string' || !message.trim()) {
      throw new ApiError(400, 'Message cannot be empty');
    }

    if (message.length > 4096) {
      throw new ApiError(400, 'Message is too long (max 4096 characters)');
    }

    let when: Date;
    if (sendNow) {
      when = new Date();
    } else {
      if (!scheduledAt) {
        throw new ApiError(400, 'scheduledAt is required unless sendNow is true');
      }
      when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new ApiError(400, 'Invalid scheduledAt date');
      }
      if (when.getTime() < Date.now() - 60_000) {
        throw new ApiError(400, 'Scheduled time must be in the future');
      }
    }

    const doc = new ScheduledWhatsAppMessage({
      userId: req.userId,
      recipientPhone: normalizedPhone,
      recipientName: recipientName?.trim() || undefined,
      message: message.trim(),
      scheduledAt: when,
      status: 'pending',
    });

    await doc.save();

    // Send immediately if requested
    if (sendNow) {
      doc.status = 'sending';
      await doc.save();
      try {
        await sendWhatsAppText(req.userId!, normalizedPhone, doc.message);
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
    const { recipientPhone, recipientName, message, scheduledAt } = req.body;

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

    if (recipientPhone !== undefined) {
      const normalizedPhone = normalizePhoneNumber(recipientPhone);
      if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
        throw new ApiError(400, 'Enter a valid phone number with country code');
      }
      doc.recipientPhone = normalizedPhone;
    }

    if (recipientName !== undefined) {
      doc.recipientName = recipientName?.trim() || undefined;
    }

    if (message !== undefined) {
      if (!message.trim()) {
        throw new ApiError(400, 'Message cannot be empty');
      }
      if (message.length > 4096) {
        throw new ApiError(400, 'Message is too long (max 4096 characters)');
      }
      doc.message = message.trim();
    }

    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new ApiError(400, 'Invalid scheduledAt date');
      }
      if (when.getTime() < Date.now() - 60_000) {
        throw new ApiError(400, 'Scheduled time must be in the future');
      }
      doc.scheduledAt = when;
    }

    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}
