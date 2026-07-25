import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import {
  createGoogleAuthUrl,
  disconnectGoogle,
  getGoogleStatus,
  handleGoogleCallback,
  isGoogleConfigured,
  listGoogleContacts,
  verifyOAuthState,
} from '../services/google.service.js';

export async function getStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.json({
      success: true,
      data: getGoogleStatus(user),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuthUrl(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const returnTo =
      typeof req.query.returnTo === 'string' && req.query.returnTo.trim()
        ? req.query.returnTo.trim()
        : '/whatsapp';

    const url = createGoogleAuthUrl(req.userId!, returnTo);
    res.json({
      success: true,
      data: { url, configured: true },
    });
  } catch (error) {
    next(error);
  }
}

export async function oauthCallback(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { code, state, error } = req.query;

    if (error) {
      const message = typeof error === 'string' ? error : 'access_denied';
      res.redirect(
        `${config.google.frontendUrl}/whatsapp?google=error&message=${encodeURIComponent(message)}`
      );
      return;
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      throw new ApiError(400, 'Missing authorization code');
    }

    const decoded = verifyOAuthState(state);
    await handleGoogleCallback(code, decoded.userId);

    if (decoded.returnTo === 'mobile') {
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Google Connected</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #f9fafb;
      display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    .card { background: #1f2937; padding: 2rem; border-radius: 1rem; max-width: 22rem; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    p { color: #9ca3af; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Google Contacts connected</h1>
    <p>You can close this window and return to the app.</p>
  </div>
</body>
</html>`);
      return;
    }

    const path = decoded.returnTo.startsWith('/') ? decoded.returnTo : `/${decoded.returnTo}`;
    res.redirect(`${config.google.frontendUrl}${path}?google=connected`);
  } catch (error) {
    if (error instanceof ApiError) {
      res.redirect(
        `${config.google.frontendUrl}/whatsapp?google=error&message=${encodeURIComponent(error.message)}`
      );
      return;
    }
    next(error);
  }
}

export async function disconnect(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await disconnectGoogle(req.userId!);
    res.json({
      success: true,
      data: {
        configured: isGoogleConfigured(),
        connected: false,
        email: null,
        connectedAt: null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listContacts(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const contacts = await listGoogleContacts(req.userId!, q);
    res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
}
