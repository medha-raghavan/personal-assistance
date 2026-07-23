import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import { config } from '../config/index.js';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

interface SessionState {
  status: ConnectionStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: any;
  reconnectAttempts: number;
}

const sessions = new Map<string, SessionState>();

const silentLogger = pino({ level: 'silent' });

function getSessionDir(userId: string): string {
  return path.join(config.whatsapp.sessionsDir, userId);
}

function ensureSessionDir(userId: string): string {
  const dir = getSessionDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOrCreateState(userId: string): SessionState {
  let state = sessions.get(userId);
  if (!state) {
    state = {
      status: 'disconnected',
      qrDataUrl: null,
      phoneNumber: null,
      lastError: null,
      socket: null,
      reconnectAttempts: 0,
    };
    sessions.set(userId, state);
  }
  return state;
}

function hasAuthFiles(userId: string): boolean {
  const credsPath = path.join(getSessionDir(userId), 'creds.json');
  return fs.existsSync(credsPath);
}

export function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    // Common local format e.g. 09876543210 → assume India (+91) if 10 digits after 0
    digits = '91' + digits.slice(1);
  }
  return digits;
}

export function toWhatsAppJid(phone: string): string {
  return `${normalizePhoneNumber(phone)}@s.whatsapp.net`;
}

async function loadBaileys() {
  return import('@whiskeysockets/baileys');
}

export async function connectWhatsApp(userId: string): Promise<SessionState> {
  const state = getOrCreateState(userId);

  if (state.status === 'connected' && state.socket) {
    return state;
  }

  if (state.status === 'connecting' || state.status === 'qr') {
    return state;
  }

  await startSocket(userId);
  return getOrCreateState(userId);
}

async function startSocket(userId: string): Promise<void> {
  const state = getOrCreateState(userId);
  state.status = 'connecting';
  state.qrDataUrl = null;
  state.lastError = null;

  const baileys = await loadBaileys();
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
  } = baileys;

  const sessionDir = ensureSessionDir(userId);
  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);

  const socket = makeWASocket({
    auth: authState,
    logger: silentLogger,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  state.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update: {
    connection?: string;
    lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } };
    qr?: string;
  }) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        state.qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 2,
          width: 320,
          color: { dark: '#111827', light: '#ffffff' },
        });
        state.status = 'qr';
      } catch (err) {
        state.lastError = err instanceof Error ? err.message : 'Failed to generate QR code';
        state.status = 'disconnected';
      }
    }

    if (connection === 'open') {
      state.status = 'connected';
      state.qrDataUrl = null;
      state.reconnectAttempts = 0;
      state.lastError = null;
      const user = socket.user;
      if (user?.id) {
        state.phoneNumber = String(user.id).split(':')[0];
      }
      console.log(`[WhatsApp] Connected for user ${userId}${state.phoneNumber ? ` (${state.phoneNumber})` : ''}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !loggedOut && state.reconnectAttempts < 5;

      state.socket = null;
      state.qrDataUrl = null;

      if (loggedOut) {
        state.status = 'disconnected';
        state.phoneNumber = null;
        state.lastError = 'WhatsApp session logged out. Please connect again.';
        clearSessionFiles(userId);
        console.log(`[WhatsApp] Logged out for user ${userId}`);
        return;
      }

      if (shouldReconnect) {
        state.reconnectAttempts += 1;
        state.status = 'connecting';
        const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 15000);
        console.log(`[WhatsApp] Reconnecting user ${userId} in ${delay}ms (attempt ${state.reconnectAttempts})`);
        setTimeout(() => {
          startSocket(userId).catch((err) => {
            state.status = 'disconnected';
            state.lastError = err instanceof Error ? err.message : 'Reconnect failed';
          });
        }, delay);
      } else {
        state.status = 'disconnected';
        state.lastError =
          lastDisconnect?.error?.message ||
          'WhatsApp connection closed. Please connect again.';
      }
    }
  });
}

function clearSessionFiles(userId: string): void {
  const dir = getSessionDir(userId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function disconnectWhatsApp(userId: string): Promise<void> {
  const state = sessions.get(userId);
  if (state?.socket) {
    try {
      await state.socket.logout();
    } catch {
      try {
        state.socket.end?.(undefined);
      } catch {
        // ignore
      }
    }
  }

  sessions.delete(userId);
  clearSessionFiles(userId);
}

export function getWhatsAppStatus(userId: string): {
  status: ConnectionStatus;
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  hasSavedSession: boolean;
} {
  const state = sessions.get(userId);
  return {
    status: state?.status || (hasAuthFiles(userId) ? 'disconnected' : 'disconnected'),
    qrDataUrl: state?.qrDataUrl || null,
    phoneNumber: state?.phoneNumber || null,
    lastError: state?.lastError || null,
    hasSavedSession: hasAuthFiles(userId),
  };
}

export async function ensureConnected(userId: string): Promise<boolean> {
  const state = getOrCreateState(userId);
  if (state.status === 'connected' && state.socket) {
    return true;
  }

  if (hasAuthFiles(userId) && state.status === 'disconnected') {
    await connectWhatsApp(userId);
    // Wait briefly for connection to open
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (getOrCreateState(userId).status === 'connected') {
        return true;
      }
    }
  }

  return getOrCreateState(userId).status === 'connected';
}

export async function sendWhatsAppText(
  userId: string,
  phone: string,
  message: string
): Promise<void> {
  const connected = await ensureConnected(userId);
  const state = getOrCreateState(userId);

  if (!connected || !state.socket) {
    throw new Error('WhatsApp is not connected. Please scan the QR code first.');
  }

  const jid = toWhatsAppJid(phone);

  const results = await state.socket.onWhatsApp(normalizePhoneNumber(phone));
  const exists = Array.isArray(results) && results[0]?.exists;
  if (!exists) {
    throw new Error(`Phone number ${normalizePhoneNumber(phone)} is not registered on WhatsApp`);
  }

  await state.socket.sendMessage(jid, { text: message });
}

export async function restoreSavedSessions(): Promise<void> {
  const baseDir = config.whatsapp.sessionsDir;
  if (!fs.existsSync(baseDir)) {
    return;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const userId = entry.name;
    if (!hasAuthFiles(userId)) continue;
    console.log(`[WhatsApp] Restoring session for user ${userId}`);
    try {
      await connectWhatsApp(userId);
    } catch (err) {
      console.error(`[WhatsApp] Failed to restore session for ${userId}:`, err);
    }
  }
}
