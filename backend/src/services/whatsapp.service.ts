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
  intentionalDisconnect: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
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
      intentionalDisconnect: false,
      reconnectTimer: null,
    };
    sessions.set(userId, state);
  }
  return state;
}

function clearReconnectTimer(state: SessionState): void {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
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

/** Cached WhatsApp Web version — required by Baileys 7+ or connect fails with 405 and no QR. */
let cachedWaVersion: number[] | null = null;
let waVersionFetchedAt = 0;
const WA_VERSION_TTL_MS = 6 * 60 * 60 * 1000;

async function getWaWebVersion(): Promise<number[] | undefined> {
  const now = Date.now();
  if (cachedWaVersion && now - waVersionFetchedAt < WA_VERSION_TTL_MS) {
    return cachedWaVersion;
  }

  try {
    const { fetchLatestBaileysVersion } = await loadBaileys();
    const { version, isLatest } = await fetchLatestBaileysVersion();
    if (Array.isArray(version) && version.length >= 3) {
      cachedWaVersion = version;
      waVersionFetchedAt = now;
      console.log(
        `[WhatsApp] Using WA Web version ${version.join('.')}${isLatest ? ' (latest)' : ''}`
      );
      return cachedWaVersion;
    }
  } catch (err) {
    console.error('[WhatsApp] Failed to fetch WA Web version:', err);
  }

  return cachedWaVersion || undefined;
}

export async function connectWhatsApp(userId: string): Promise<SessionState> {
  const state = getOrCreateState(userId);
  state.intentionalDisconnect = false;

  if (state.status === 'connected' && state.socket) {
    return state;
  }

  // Reuse only when we already have a QR ready (user is scanning)
  if (state.status === 'qr' && state.socket && state.qrDataUrl) {
    return state;
  }

  // Force a fresh socket when stuck in connecting without QR
  clearReconnectTimer(state);
  state.reconnectAttempts = 0;
  await startSocket(userId);
  return getOrCreateState(userId);
}

async function startSocket(userId: string): Promise<void> {
  const state = getOrCreateState(userId);
  if (state.intentionalDisconnect) {
    state.status = 'disconnected';
    return;
  }

  clearReconnectTimer(state);
  state.status = 'connecting';
  state.qrDataUrl = null;
  state.lastError = null;

  // Tear down any leftover socket before opening a new one
  if (state.socket) {
    try {
      state.socket.ev?.removeAllListeners?.('connection.update');
      state.socket.ev?.removeAllListeners?.('creds.update');
      state.socket.end?.(undefined);
    } catch {
      // ignore
    }
    state.socket = null;
  }

  const baileys = await loadBaileys();
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
  } = baileys;

  const sessionDir = ensureSessionDir(userId);
  // Empty/corrupt session dirs (e.g. after a failed disconnect) prevent a clean QR login
  if (!hasAuthFiles(userId) && fs.existsSync(sessionDir)) {
    try {
      for (const name of fs.readdirSync(sessionDir)) {
        fs.rmSync(path.join(sessionDir, name), { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`[WhatsApp] Failed to clean session dir for ${userId}:`, err);
    }
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir);
  const version = await getWaWebVersion();
  if (!version) {
    state.status = 'disconnected';
    state.lastError =
      'Could not fetch WhatsApp Web version. Check server internet access and try again.';
    return;
  }

  const socket = makeWASocket({
    auth: authState,
    logger: silentLogger,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    version,
  });

  state.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update: {
    connection?: string;
    lastDisconnect?: { error?: { output?: { statusCode?: number }; message?: string } };
    qr?: string;
  }) => {
    // Ignore events from a superseded socket
    if (getOrCreateState(userId).socket !== socket) {
      return;
    }

    const current = getOrCreateState(userId);
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        current.qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 2,
          width: 320,
          color: { dark: '#111827', light: '#ffffff' },
        });
        current.status = 'qr';
        current.lastError = null;
      } catch (err) {
        current.lastError = err instanceof Error ? err.message : 'Failed to generate QR code';
        current.status = 'disconnected';
      }
    }

    if (connection === 'open') {
      current.status = 'connected';
      current.qrDataUrl = null;
      current.reconnectAttempts = 0;
      current.lastError = null;
      const user = socket.user;
      if (user?.id) {
        current.phoneNumber = String(user.id).split(':')[0];
      }
      console.log(`[WhatsApp] Connected for user ${userId}${current.phoneNumber ? ` (${current.phoneNumber})` : ''}`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      // 405 = outdated WA Web version — refresh cache before retrying
      if (statusCode === 405) {
        cachedWaVersion = null;
        waVersionFetchedAt = 0;
      }

      current.socket = null;
      current.qrDataUrl = null;

      if (current.intentionalDisconnect) {
        current.status = 'disconnected';
        current.phoneNumber = null;
        clearReconnectTimer(current);
        console.log(`[WhatsApp] Intentional disconnect for user ${userId}`);
        return;
      }

      if (loggedOut) {
        current.status = 'disconnected';
        current.phoneNumber = null;
        current.lastError = 'WhatsApp session logged out. Please connect again.';
        clearReconnectTimer(current);
        clearSessionFiles(userId);
        console.log(`[WhatsApp] Logged out for user ${userId}`);
        return;
      }

      const shouldReconnect = current.reconnectAttempts < 5;

      if (shouldReconnect) {
        current.reconnectAttempts += 1;
        current.status = 'connecting';
        const delay = Math.min(1000 * Math.pow(2, current.reconnectAttempts), 15000);
        console.log(
          `[WhatsApp] Reconnecting user ${userId} in ${delay}ms (attempt ${current.reconnectAttempts}, code=${statusCode ?? 'n/a'})`
        );
        clearReconnectTimer(current);
        current.reconnectTimer = setTimeout(() => {
          current.reconnectTimer = null;
          if (current.intentionalDisconnect) {
            current.status = 'disconnected';
            return;
          }
          startSocket(userId).catch((err) => {
            current.status = 'disconnected';
            current.lastError = err instanceof Error ? err.message : 'Reconnect failed';
          });
        }, delay);
      } else {
        current.status = 'disconnected';
        current.lastError =
          lastDisconnect?.error?.message ||
          'WhatsApp connection closed. Please connect again.';
      }
    }
  });
}

function clearSessionFiles(userId: string): void {
  const dir = getSessionDir(userId);
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[WhatsApp] Failed to clear session files for ${userId}:`, err);
    }
  }
}

export async function disconnectWhatsApp(userId: string): Promise<void> {
  const state = sessions.get(userId);
  if (state) {
    state.intentionalDisconnect = true;
    state.reconnectAttempts = 5;
    clearReconnectTimer(state);

    if (state.socket) {
      const socket = state.socket;
      try {
        socket.ev?.removeAllListeners?.('connection.update');
        socket.ev?.removeAllListeners?.('creds.update');
      } catch {
        // ignore
      }

      try {
        await socket.logout();
      } catch {
        try {
          socket.end?.(undefined);
        } catch {
          // ignore
        }
      }
      state.socket = null;
    }

    state.status = 'disconnected';
    state.qrDataUrl = null;
    state.phoneNumber = null;
    state.lastError = null;
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

  if (state.intentionalDisconnect) {
    return false;
  }

  if (hasAuthFiles(userId) && (state.status === 'disconnected' || !state.socket)) {
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

export interface WhatsAppGroupInfo {
  id: string;
  name: string;
  participantCount: number;
}

const GROUP_JID_RE = /^\d+@g\.us$/;

export function isGroupJid(jid: string): boolean {
  return GROUP_JID_RE.test(jid);
}

export async function listWhatsAppGroups(userId: string): Promise<WhatsAppGroupInfo[]> {
  const connected = await ensureConnected(userId);
  const state = getOrCreateState(userId);

  if (!connected || !state.socket) {
    throw new Error('WhatsApp is not connected. Please scan the QR code first.');
  }

  const groupsMap = await state.socket.groupFetchAllParticipating();
  const groups: WhatsAppGroupInfo[] = Object.values(groupsMap || {}).map(
    (g: { id?: string; subject?: string; participants?: unknown[] }) => ({
      id: String(g.id || ''),
      name: String(g.subject || 'Unnamed group'),
      participantCount: Array.isArray(g.participants) ? g.participants.length : 0,
    })
  );

  return groups
    .filter((g) => g.id && isGroupJid(g.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function sendWhatsAppMessage(
  userId: string,
  jid: string,
  message: string
): Promise<void> {
  const connected = await ensureConnected(userId);
  const state = getOrCreateState(userId);

  if (!connected || !state.socket) {
    throw new Error('WhatsApp is not connected. Please scan the QR code first.');
  }

  if (isGroupJid(jid)) {
    await state.socket.sendMessage(jid, { text: message });
    return;
  }

  const phone = normalizePhoneNumber(jid.replace(/@s\.whatsapp\.net$/, ''));
  const contactJid = toWhatsAppJid(phone);

  const results = await state.socket.onWhatsApp(phone);
  const exists = Array.isArray(results) && results[0]?.exists;
  if (!exists) {
    throw new Error(`Phone number ${phone} is not registered on WhatsApp`);
  }

  await state.socket.sendMessage(contactJid, { text: message });
}

export async function sendWhatsAppText(
  userId: string,
  phone: string,
  message: string
): Promise<void> {
  await sendWhatsAppMessage(userId, toWhatsAppJid(phone), message);
}

export async function sendScheduledWhatsAppMessage(
  userId: string,
  opts: {
    recipientType?: 'contact' | 'group';
    recipientPhone?: string;
    recipientJid?: string;
    message: string;
  }
): Promise<void> {
  if (opts.recipientType === 'group') {
    if (!opts.recipientJid || !isGroupJid(opts.recipientJid)) {
      throw new Error('Invalid or missing group JID');
    }
    await sendWhatsAppMessage(userId, opts.recipientJid, opts.message);
    return;
  }

  if (!opts.recipientPhone) {
    throw new Error('Recipient phone is required');
  }
  await sendWhatsAppText(userId, opts.recipientPhone, opts.message);
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
