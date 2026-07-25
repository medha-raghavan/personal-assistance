import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User, IUser } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';
import { normalizePhoneNumber } from './whatsapp.service.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CONNECTIONS_URL = 'https://people.googleapis.com/v1/people/me/connections';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

export interface GoogleContactPhone {
  label?: string;
  phone: string;
  displayPhone: string;
}

export interface GoogleContact {
  resourceName: string;
  name: string;
  email?: string;
  photoUrl?: string;
  phones: GoogleContactPhone[];
}

interface OAuthState {
  userId: string;
  returnTo: string;
  purpose: 'google-oauth';
}

function assertGoogleConfigured(): void {
  if (!config.google.clientId || !config.google.clientSecret) {
    throw new ApiError(
      503,
      'Google Contacts is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    );
  }
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

export function getGoogleStatus(user: IUser): {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
} {
  return {
    configured: isGoogleConfigured(),
    connected: Boolean(user.google?.refreshToken || user.google?.accessToken),
    email: user.google?.email || null,
    connectedAt: user.google?.connectedAt?.toISOString() || null,
  };
}

export function createGoogleAuthUrl(userId: string, returnTo = '/whatsapp'): string {
  assertGoogleConfigured();

  const state = jwt.sign(
    { userId, returnTo, purpose: 'google-oauth' } satisfies OAuthState,
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function verifyOAuthState(state: string): OAuthState {
  try {
    const decoded = jwt.verify(state, config.jwt.secret) as OAuthState;
    if (decoded.purpose !== 'google-oauth' || !decoded.userId) {
      throw new Error('Invalid state');
    }
    return decoded;
  } catch {
    throw new ApiError(400, 'Invalid or expired Google sign-in state. Please try again.');
  }
}

async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Google] Token exchange failed:', text);
    throw new ApiError(400, 'Failed to complete Google sign-in');
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
  }>;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Google] Token refresh failed:', text);
    throw new ApiError(401, 'Google session expired. Please reconnect Google Contacts.');
  }

  return response.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function fetchGoogleEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

export async function handleGoogleCallback(code: string, userId: string): Promise<IUser> {
  assertGoogleConfigured();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const tokens = await exchangeCodeForTokens(code);
  const email = await fetchGoogleEmail(tokens.access_token);

  user.google = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || user.google?.refreshToken,
    expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
    email: email || user.google?.email,
    connectedAt: new Date(),
  };

  if (!user.google.refreshToken) {
    throw new ApiError(
      400,
      'Google did not return a refresh token. Remove app access in Google Account settings and try again.'
    );
  }

  await user.save();
  return user;
}

export async function disconnectGoogle(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const accessToken = user.google?.accessToken;
  await User.findByIdAndUpdate(userId, { $unset: { google: 1 } });

  if (accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // ignore revoke errors
    }
  }
}

async function getValidAccessToken(user: IUser): Promise<string> {
  if (!user.google?.accessToken && !user.google?.refreshToken) {
    throw new ApiError(401, 'Google Contacts is not connected');
  }

  const expiresAt = user.google.expiryDate?.getTime() || 0;
  const stillValid = expiresAt > Date.now() + 60_000;

  if (user.google.accessToken && stillValid) {
    return user.google.accessToken;
  }

  if (!user.google.refreshToken) {
    throw new ApiError(401, 'Google session expired. Please reconnect Google Contacts.');
  }

  const refreshed = await refreshAccessToken(user.google.refreshToken);
  user.google.accessToken = refreshed.access_token;
  user.google.expiryDate = new Date(Date.now() + refreshed.expires_in * 1000);
  await user.save();
  return refreshed.access_token;
}

function pickDisplayName(person: {
  names?: Array<{ displayName?: string; unstructuredName?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
}): string {
  const name =
    person.names?.[0]?.displayName ||
    person.names?.[0]?.unstructuredName ||
    person.phoneNumbers?.[0]?.value ||
    'Unknown';
  return name.trim();
}

function mapPersonToContact(person: {
  resourceName?: string;
  names?: Array<{ displayName?: string; unstructuredName?: string }>;
  emailAddresses?: Array<{ value?: string }>;
  photos?: Array<{ url?: string }>;
  phoneNumbers?: Array<{ value?: string; type?: string; formattedType?: string }>;
}): GoogleContact | null {
  const phones = (person.phoneNumbers || [])
    .map((p) => {
      const displayPhone = (p.value || '').trim();
      if (!displayPhone) return null;
      const phone = normalizePhoneNumber(displayPhone);
      if (phone.length < 8) return null;
      return {
        label: p.formattedType || p.type || undefined,
        phone,
        displayPhone,
      } as GoogleContactPhone;
    })
    .filter((p): p is GoogleContactPhone => Boolean(p));

  if (phones.length === 0) return null;

  return {
    resourceName: person.resourceName || '',
    name: pickDisplayName(person),
    email: person.emailAddresses?.[0]?.value,
    photoUrl: person.photos?.[0]?.url,
    phones,
  };
}

export async function listGoogleContacts(
  userId: string,
  query?: string
): Promise<GoogleContact[]> {
  assertGoogleConfigured();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.google?.refreshToken && !user.google?.accessToken) {
    throw new ApiError(401, 'Google Contacts is not connected');
  }

  const accessToken = await getValidAccessToken(user);
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers,photos',
      pageSize: '100',
      sortOrder: 'FIRST_NAME_ASCENDING',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`${GOOGLE_CONNECTIONS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      throw new ApiError(401, 'Google session expired. Please reconnect Google Contacts.');
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('[Google] Contacts fetch failed:', text);
      throw new ApiError(502, 'Failed to fetch Google contacts');
    }

    const data = (await response.json()) as {
      connections?: Array<{
        resourceName?: string;
        names?: Array<{ displayName?: string; unstructuredName?: string }>;
        emailAddresses?: Array<{ value?: string }>;
        photos?: Array<{ url?: string }>;
        phoneNumbers?: Array<{ value?: string; type?: string; formattedType?: string }>;
      }>;
      nextPageToken?: string;
    };

    for (const person of data.connections || []) {
      const contact = mapPersonToContact(person);
      if (contact) contacts.push(contact);
    }

    pageToken = data.nextPageToken;
  } while (pageToken && contacts.length < 1000);

  const q = query?.trim().toLowerCase();
  if (!q) {
    return contacts.sort((a, b) => a.name.localeCompare(b.name));
  }

  return contacts
    .filter((c) => {
      const haystack = [
        c.name,
        c.email || '',
        ...c.phones.map((p) => `${p.phone} ${p.displayPhone}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
