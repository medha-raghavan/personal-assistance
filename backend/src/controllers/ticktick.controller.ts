import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { User } from '../models/User.js';
import { config } from '../config/index.js';
import {
  completeTickTickTask,
  createTickTickAuthUrl,
  createTickTickNote,
  disconnectTickTick,
  getTickTickStatus,
  getWeekDashboard,
  handleTickTickCallback,
  isTickTickConfigured,
  updateTickTickNote,
  verifyTickTickOAuthState,
} from '../services/ticktick.service.js';

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
      data: getTickTickStatus(user),
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
        : '/';

    const url = createTickTickAuthUrl(req.userId!, returnTo);
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
        `${config.ticktick.frontendUrl}/?ticktick=error&message=${encodeURIComponent(message)}`
      );
      return;
    }

    if (typeof code !== 'string' || typeof state !== 'string') {
      throw new ApiError(400, 'Missing authorization code');
    }

    const decoded = verifyTickTickOAuthState(state);
    await handleTickTickCallback(code, decoded.userId);

    if (decoded.returnTo === 'mobile') {
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TickTick Connected</title>
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
    <h1>TickTick connected</h1>
    <p>You can close this window and return to the app.</p>
  </div>
</body>
</html>`);
      return;
    }

    const path = decoded.returnTo.startsWith('/') ? decoded.returnTo : `/${decoded.returnTo}`;
    res.redirect(`${config.ticktick.frontendUrl}${path}?ticktick=connected`);
  } catch (error) {
    if (error instanceof ApiError) {
      res.redirect(
        `${config.ticktick.frontendUrl}/?ticktick=error&message=${encodeURIComponent(error.message)}`
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
    await disconnectTickTick(req.userId!);
    res.json({
      success: true,
      data: {
        configured: isTickTickConfigured(),
        connected: false,
        connectedAt: null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function weekDashboard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await getWeekDashboard(req.userId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function completeTask(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId, taskId } = req.params;
    if (!projectId || !taskId) {
      throw new ApiError(400, 'projectId and taskId are required');
    }

    await completeTickTickTask(req.userId!, projectId, taskId);
    res.json({ success: true, data: { completed: true } });
  } catch (error) {
    next(error);
  }
}

export async function createNote(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    const note = await createTickTickNote(req.userId!, title);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
}

export async function updateNote(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectId, taskId } = req.params;
    const title = typeof req.body?.title === 'string' ? req.body.title : '';
    if (!projectId || !taskId) {
      throw new ApiError(400, 'projectId and taskId are required');
    }
    const note = await updateTickTickNote(req.userId!, projectId, taskId, title);
    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
}
