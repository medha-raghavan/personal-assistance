import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User, IUser } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';

const TICKTICK_AUTH_URL = 'https://ticktick.com/oauth/authorize';
const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
const TICKTICK_API_BASE = 'https://api.ticktick.com/open/v1';
const SCOPES = 'tasks:read tasks:write';

interface OAuthState {
  userId: string;
  returnTo: string;
  purpose: 'ticktick-oauth';
}

interface TickTickTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface TickTickProject {
  id: string;
  name: string;
  closed?: boolean;
}

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  priority: number;
  status: number;
  dueDate?: string;
  startDate?: string;
  isAllDay?: boolean;
  timeZone?: string;
  tags?: string[];
  parentId?: string;
  items?: TickTickChecklistItem[];
}

export interface TickTickChecklistItem {
  id: string;
  title: string;
  status: number;
}

export interface WeekDashboardTask {
  id: string;
  projectId: string;
  title: string;
  due?: string;
  dueLabel?: string;
  /** Human label for how long overdue / pending, e.g. "3d" or "since Mon" */
  pendingSinceLabel?: string;
}

export interface WeekCalendarDay {
  day: string;
  date: string;
  events: string[];
  flag?: boolean;
}

export interface WeekDashboardGoal {
  id: string;
  title: string;
  progress: number;
  completed: number;
  total: number;
  goalCompleted: boolean;
}

export interface WeekDashboardPayload {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  calendar: WeekCalendarDay[];
  doFirst: WeekDashboardTask[];
  schedule: WeekDashboardTask[];
  pending: WeekDashboardTask[];
  nextWeek: WeekDashboardTask[];
  notes: WeekDashboardTask[];
  yearlyGoals: WeekDashboardGoal[];
}

function assertTickTickConfigured(): void {
  if (!config.ticktick.clientId || !config.ticktick.clientSecret) {
    throw new ApiError(
      503,
      'TickTick is not configured. Set TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET.'
    );
  }
}

export function isTickTickConfigured(): boolean {
  return Boolean(config.ticktick.clientId && config.ticktick.clientSecret);
}

export function getTickTickStatus(user: IUser): {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
} {
  return {
    configured: isTickTickConfigured(),
    connected: Boolean(user.ticktick?.refreshToken || user.ticktick?.accessToken),
    connectedAt: user.ticktick?.connectedAt?.toISOString() || null,
  };
}

export function createTickTickAuthUrl(userId: string, returnTo = '/'): string {
  assertTickTickConfigured();

  const state = jwt.sign(
    { userId, returnTo, purpose: 'ticktick-oauth' } satisfies OAuthState,
    config.jwt.secret,
    { expiresIn: '15m' }
  );

  const params = new URLSearchParams({
    client_id: config.ticktick.clientId,
    redirect_uri: config.ticktick.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  });

  return `${TICKTICK_AUTH_URL}?${params.toString()}`;
}

export function verifyTickTickOAuthState(state: string): OAuthState {
  try {
    const decoded = jwt.verify(state, config.jwt.secret) as OAuthState;
    if (decoded.purpose !== 'ticktick-oauth' || !decoded.userId) {
      throw new Error('Invalid state');
    }
    return decoded;
  } catch {
    throw new ApiError(400, 'Invalid or expired TickTick sign-in state. Please try again.');
  }
}

async function exchangeCodeForTokens(code: string): Promise<TickTickTokenResponse> {
  const basic = Buffer.from(
    `${config.ticktick.clientId}:${config.ticktick.clientSecret}`
  ).toString('base64');

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    scope: SCOPES,
    redirect_uri: config.ticktick.redirectUri,
  });

  const response = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[TickTick] Token exchange failed:', text);
    throw new ApiError(400, 'Failed to complete TickTick sign-in');
  }

  return response.json() as Promise<TickTickTokenResponse>;
}

async function refreshAccessToken(refreshToken: string): Promise<TickTickTokenResponse> {
  const basic = Buffer.from(
    `${config.ticktick.clientId}:${config.ticktick.clientSecret}`
  ).toString('base64');

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const response = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[TickTick] Token refresh failed:', text);
    throw new ApiError(401, 'TickTick session expired. Please reconnect TickTick.');
  }

  return response.json() as Promise<TickTickTokenResponse>;
}

export async function handleTickTickCallback(code: string, userId: string): Promise<IUser> {
  assertTickTickConfigured();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const tokens = await exchangeCodeForTokens(code);

  user.ticktick = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || user.ticktick?.refreshToken,
    expiryDate: new Date(Date.now() + (tokens.expires_in || 15552000) * 1000),
    connectedAt: new Date(),
  };

  if (!user.ticktick.refreshToken && !user.ticktick.accessToken) {
    throw new ApiError(400, 'TickTick did not return tokens. Please try again.');
  }

  await user.save();
  return user;
}

export async function disconnectTickTick(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await User.findByIdAndUpdate(userId, { $unset: { ticktick: 1 } });
}

async function getValidAccessToken(user: IUser): Promise<string> {
  if (!user.ticktick?.accessToken && !user.ticktick?.refreshToken) {
    throw new ApiError(401, 'TickTick is not connected');
  }

  const expiresAt = user.ticktick.expiryDate?.getTime() || 0;
  const stillValid = expiresAt > Date.now() + 60_000;

  if (user.ticktick.accessToken && stillValid) {
    return user.ticktick.accessToken;
  }

  if (!user.ticktick.refreshToken) {
    // Long-lived access tokens may still work without refresh
    if (user.ticktick.accessToken) {
      return user.ticktick.accessToken;
    }
    throw new ApiError(401, 'TickTick session expired. Please reconnect TickTick.');
  }

  const refreshed = await refreshAccessToken(user.ticktick.refreshToken);
  user.ticktick.accessToken = refreshed.access_token;
  if (refreshed.refresh_token) {
    user.ticktick.refreshToken = refreshed.refresh_token;
  }
  user.ticktick.expiryDate = new Date(
    Date.now() + (refreshed.expires_in || 15552000) * 1000
  );
  await user.save();
  return refreshed.access_token;
}

async function ticktickFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${TICKTICK_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    throw new ApiError(401, 'TickTick session expired. Please reconnect TickTick.');
  }

  if (!response.ok) {
    const text = await response.text();
    console.error(`[TickTick] API ${path} failed:`, text);
    throw new ApiError(502, 'TickTick API request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function loadUserForTickTick(userId: string): Promise<{ user: IUser; accessToken: string }> {
  assertTickTickConfigured();

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.ticktick?.refreshToken && !user.ticktick?.accessToken) {
    throw new ApiError(401, 'TickTick is not connected');
  }

  const accessToken = await getValidAccessToken(user);
  return { user, accessToken };
}

async function fetchAllTasks(accessToken: string): Promise<{
  projects: TickTickProject[];
  tasks: TickTickTask[];
}> {
  const projects =
    (await ticktickFetch<TickTickProject[]>(accessToken, '/project')) || [];

  const openProjects = projects.filter((p) => !p.closed);
  const tasks: TickTickTask[] = [];

  await Promise.all(
    openProjects.map(async (project) => {
      try {
        const data = await ticktickFetch<{ tasks?: Record<string, unknown>[] }>(
          accessToken,
          `/project/${project.id}/data`
        );
        for (const raw of data?.tasks || []) {
          tasks.push(normalizeTask(raw, project.id));
        }
      } catch (err) {
        console.error(`[TickTick] Failed to load project ${project.id}:`, err);
      }
    })
  );

  return { projects: openProjects, tasks };
}

function normalizeStatus(value: unknown): number {
  if (value === 2 || value === '2') return 2;
  if (value === true) return 2;
  return 0;
}

function normalizeChecklistItems(raw: unknown): TickTickChecklistItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const items = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const id = item.id != null ? String(item.id) : '';
      if (!id) return null;
      return {
        id,
        title: String(item.title ?? ''),
        status: normalizeStatus(item.status),
      };
    })
    .filter((item): item is TickTickChecklistItem => item !== null);

  return items.length > 0 ? items : undefined;
}

function normalizeTask(raw: Record<string, unknown>, fallbackProjectId: string): TickTickTask {
  const parentId = raw.parentId ?? raw.parent_id ?? raw.parentTaskId;
  const tags = raw.tags;

  return {
    id: String(raw.id ?? ''),
    projectId: String(raw.projectId ?? raw.project_id ?? fallbackProjectId),
    title: String(raw.title ?? ''),
    content: raw.content != null ? String(raw.content) : undefined,
    desc: raw.desc != null ? String(raw.desc) : undefined,
    priority: Number(raw.priority ?? 0),
    status: normalizeStatus(raw.status),
    dueDate: raw.dueDate != null ? String(raw.dueDate) : undefined,
    startDate: raw.startDate != null ? String(raw.startDate) : undefined,
    isAllDay: raw.isAllDay === true,
    timeZone: raw.timeZone != null ? String(raw.timeZone) : undefined,
    tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()) : undefined,
    parentId: parentId != null && parentId !== '' ? String(parentId) : undefined,
    items: normalizeChecklistItems(raw.items),
  };
}

function mergeTaskRecord(existing: TickTickTask, incoming: TickTickTask): TickTickTask {
  return {
    ...existing,
    ...incoming,
    tags: incoming.tags?.length ? incoming.tags : existing.tags,
    parentId: incoming.parentId ?? existing.parentId,
    items: incoming.items?.length ? incoming.items : existing.items,
    status: incoming.status ?? existing.status,
  };
}

async function fetchTaskDetail(
  accessToken: string,
  projectId: string,
  taskId: string
): Promise<TickTickTask | null> {
  try {
    const raw = await ticktickFetch<Record<string, unknown>>(
      accessToken,
      `/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`
    );
    return raw ? normalizeTask(raw, projectId) : null;
  } catch (err) {
    console.error(`[TickTick] Failed to fetch task detail ${taskId}:`, err);
    return null;
  }
}

async function enrichTasksWithDetails(
  accessToken: string,
  tasks: TickTickTask[],
  concurrency = 6
): Promise<TickTickTask[]> {
  const enriched: TickTickTask[] = [];

  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (task) => {
        const detail = await fetchTaskDetail(accessToken, task.projectId, task.id);
        return detail ? mergeTaskRecord(task, detail) : task;
      })
    );
    enriched.push(...results);
  }

  return enriched;
}

async function fetchTasksByFilter(
  accessToken: string,
  filter: Record<string, unknown>
): Promise<TickTickTask[]> {
  try {
    const results =
      (await ticktickFetch<Record<string, unknown>[]>(accessToken, '/task/filter', {
        method: 'POST',
        body: JSON.stringify(filter),
      })) || [];

    const projectId = Array.isArray(filter.projectIds) ? String(filter.projectIds[0]) : '';

    return results
      .map((raw) => normalizeTask(raw, String(raw.projectId ?? projectId)))
      .filter((task) => task.id);
  } catch (err) {
    console.error('[TickTick] Failed to filter tasks:', err, filter);
    return [];
  }
}

async function fetchTasksByTag(
  accessToken: string,
  tag: string,
  projectId?: string
): Promise<TickTickTask[]> {
  const merged = new Map<string, TickTickTask>();

  for (const status of [0, 2] as const) {
    const filter: Record<string, unknown> = { tag: [tag], status: [status] };
    if (projectId) {
      filter.projectIds = [projectId];
    }

    for (const task of await fetchTasksByFilter(accessToken, filter)) {
      merged.set(task.id, task);
    }
  }

  return Array.from(merged.values());
}

async function fetchOpenTasksForProjects(
  accessToken: string,
  projects: TickTickProject[]
): Promise<TickTickTask[]> {
  const merged = new Map<string, TickTickTask>();

  const projectIds = [
    ...projects.filter((project) => !project.closed).map((project) => project.id),
    'inbox',
  ];

  await Promise.all(
    projectIds.map(async (projectId) => {
      const tasks = await fetchTasksByFilter(accessToken, {
        projectIds: [projectId],
        status: [0],
      });
      for (const task of tasks) {
        merged.set(task.id, task);
      }
    })
  );

  return Array.from(merged.values());
}

async function fetchCompletedTasksForProjects(
  accessToken: string,
  projects: TickTickProject[]
): Promise<TickTickTask[]> {
  const merged = new Map<string, TickTickTask>();

  const projectIds = [
    ...projects.filter((project) => !project.closed).map((project) => project.id),
    'inbox',
  ];

  await Promise.all(
    projectIds.map(async (projectId) => {
      const tasks = await fetchTasksByFilter(accessToken, {
        projectIds: [projectId],
        status: [2],
      });
      for (const task of tasks) {
        merged.set(task.id, task);
      }
    })
  );

  return Array.from(merged.values());
}

function mergeTasksById(...taskGroups: TickTickTask[][]): TickTickTask[] {
  const merged = new Map<string, TickTickTask>();
  for (const group of taskGroups) {
    for (const task of group) {
      if (!task.id) continue;
      const existing = merged.get(task.id);
      merged.set(task.id, existing ? mergeTaskRecord(existing, task) : task);
    }
  }
  return Array.from(merged.values());
}

async function fetchAllGoalTasks(
  accessToken: string,
  tag: string,
  projects: TickTickProject[]
): Promise<TickTickTask[]> {
  const merged = new Map<string, TickTickTask>();

  const addTasks = (tasks: TickTickTask[]) => {
    for (const task of tasks) {
      if (task.id) {
        merged.set(task.id, task);
      }
    }
  };

  addTasks(await fetchTasksByTag(accessToken, tag));

  const projectIds = [
    ...projects.filter((project) => !project.closed).map((project) => project.id),
    'inbox',
  ];

  await Promise.all(
    projectIds.map(async (projectId) => {
      addTasks(await fetchTasksByTag(accessToken, tag, projectId));
    })
  );

  return Array.from(merged.values());
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parseTickTickDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isIncomplete(task: TickTickTask): boolean {
  // 0 = active/incomplete, 2 = completed
  return task.status !== 2;
}

function isCompleted(task: TickTickTask): boolean {
  return task.status === 2;
}

function isChecklistItemCompleted(item: TickTickChecklistItem): boolean {
  return item.status === 1 || item.status === 2;
}

function hasGoalTag(task: TickTickTask, year: number): boolean {
  const goalTag = `Goal(${year})`;
  return (task.tags || []).some(
    (tag) => tag.trim().toLowerCase() === goalTag.toLowerCase()
  );
}

function isTopLevelGoal(task: TickTickTask, year: number, childIds: Set<string>): boolean {
  if (!hasGoalTag(task, year)) return false;
  if (task.parentId) return false;
  if (childIds.has(task.id)) return false;
  return true;
}

function getGoalProgress(
  goal: TickTickTask,
  childTasks: TickTickTask[]
): { progress: number; completed: number; total: number } {
  if (childTasks.length > 0) {
    const completed = childTasks.filter(isCompleted).length;
    return {
      progress: Math.round((completed / childTasks.length) * 100),
      completed,
      total: childTasks.length,
    };
  }

  const items = goal.items || [];
  if (items.length > 0) {
    const completed = items.filter((item) => isChecklistItemCompleted(item)).length;
    return {
      progress: Math.round((completed / items.length) * 100),
      completed,
      total: items.length,
    };
  }

  return { progress: 0, completed: 0, total: 0 };
}

function buildYearlyGoals(
  taggedTasks: TickTickTask[],
  taskPool: TickTickTask[],
  year: number
): WeekDashboardGoal[] {
  const tasksById = new Map<string, TickTickTask>();
  for (const task of mergeTasksById(taggedTasks, taskPool)) {
    tasksById.set(task.id, task);
  }

  const childrenByParent = new Map<string, TickTickTask[]>();
  for (const task of tasksById.values()) {
    if (!task.parentId) continue;
    const siblings = childrenByParent.get(task.parentId) || [];
    siblings.push(task);
    childrenByParent.set(task.parentId, siblings);
  }

  const childIds = new Set<string>();
  for (const children of childrenByParent.values()) {
    for (const child of children) {
      childIds.add(child.id);
    }
  }

  const goalsById = new Map<string, TickTickTask>();
  for (const task of tasksById.values()) {
    if (isTopLevelGoal(task, year, childIds)) {
      goalsById.set(task.id, task);
    }
  }

  return Array.from(goalsById.values())
    .map((goal) => {
      const childTasks = childrenByParent.get(goal.id) || [];
      const { progress, completed, total } = getGoalProgress(goal, childTasks);
      const allSubtasksComplete = total > 0 && completed === total;

      return {
        id: goal.id,
        title: goal.title || '(untitled)',
        progress,
        completed,
        total,
        goalCompleted: isCompleted(goal) || allSubtasksComplete,
      };
    })
    .sort((a, b) => {
      if (a.goalCompleted !== b.goalCompleted) {
        return a.goalCompleted ? 1 : -1;
      }
      return a.title.localeCompare(b.title);
    });
}

function isImportant(task: TickTickTask): boolean {
  return task.priority === 5;
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function weekdayShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function weekdayUpper(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function monthDayLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();
  return `${fmt(start)} – ${fmt(end)}`;
}

function toDashboardTask(
  task: TickTickTask,
  due?: Date | null,
  extras?: { pendingSinceLabel?: string }
): WeekDashboardTask {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title || '(untitled)',
    due: due?.toISOString(),
    dueLabel: due ? weekdayShort(due) : undefined,
    pendingSinceLabel: extras?.pendingSinceLabel,
  };
}

function pendingSinceLabel(due: Date, now: Date): string {
  const dueDay = startOfDay(due);
  const today = startOfDay(now);
  const ms = today.getTime() - dueDay.getTime();
  const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));

  if (days === 0) return 'since today';
  if (days === 1) return '1d pending';
  return `${days}d pending`;
}

export async function getWeekDashboard(userId: string): Promise<WeekDashboardPayload> {
  const { accessToken } = await loadUserForTickTick(userId);
  const { projects, tasks } = await fetchAllTasks(accessToken);

  const now = new Date();
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeekMonday(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const nextWeekStart = startOfDay(addDays(weekStart, 7));
  const nextWeekEnd = endOfDay(addDays(weekStart, 13));

  const incomplete = tasks.filter(isIncomplete);

  const doFirst: WeekDashboardTask[] = [];
  const schedule: WeekDashboardTask[] = [];
  const pending: WeekDashboardTask[] = [];
  const nextWeek: WeekDashboardTask[] = [];
  const notes: WeekDashboardTask[] = [];

  const notesProject = projects.find(
    (p) => p.name.trim().toLowerCase() === 'notes'
  );

  const calendarBuckets = new Map<string, string[]>();
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    calendarBuckets.set(startOfDay(day).toISOString(), []);
  }

  for (const task of incomplete) {
    const due = parseTickTickDate(task.dueDate);
    const start = parseTickTickDate(task.startDate);
    const eventDate = start || due;

    const important = isImportant(task);
    const dueThisWeek = Boolean(
      due && due.getTime() >= weekStart.getTime() && due.getTime() <= weekEnd.getTime()
    );
    // Urgent = due on or before today
    const urgent = Boolean(due && due.getTime() <= todayEnd.getTime());
    // Pending = overdue or due today (not future)
    const isPending = Boolean(due && due.getTime() <= todayEnd.getTime());

    // Do First: urgent & important
    if (urgent && important) {
      doFirst.push(
        toDashboardTask(task, due, {
          pendingSinceLabel: due ? pendingSinceLabel(due, now) : undefined,
        })
      );
    } else if (dueThisWeek && !isPending) {
      // Schedule: this week, not pending, and not urgent+important
      schedule.push(toDashboardTask(task, due));
    }

    // Pending: incomplete through today (overdue/today) — not shown in Schedule
    if (isPending) {
      pending.push(
        toDashboardTask(task, due, {
          pendingSinceLabel: due ? pendingSinceLabel(due, now) : undefined,
        })
      );
    }

    if (due && due.getTime() >= nextWeekStart.getTime() && due.getTime() <= nextWeekEnd.getTime()) {
      nextWeek.push(toDashboardTask(task, due));
    }

    if (notesProject && task.projectId === notesProject.id) {
      notes.push(toDashboardTask(task, due));
    }

    const isTimed = task.isAllDay === false;
    if (
      eventDate &&
      eventDate.getTime() >= weekStart.getTime() &&
      eventDate.getTime() <= weekEnd.getTime()
    ) {
      const key = startOfDay(eventDate).toISOString();
      const bucket = calendarBuckets.get(key);
      if (bucket) {
        const label =
          isTimed && start
            ? `${formatTime(start)} — ${task.title}`
            : isTimed && due
              ? `${formatTime(due)} — ${task.title}`
              : task.title;
        bucket.push(label);
      }
    }
  }

  const calendar: WeekCalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const key = startOfDay(day).toISOString();
    calendar.push({
      day: weekdayUpper(day),
      date: String(day.getDate()),
      events: calendarBuckets.get(key) || [],
    });
  }

  const sortByDue = (a: WeekDashboardTask, b: WeekDashboardTask) => {
    const at = a.due ? new Date(a.due).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.due ? new Date(b.due).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  };

  doFirst.sort(sortByDue);
  schedule.sort(sortByDue);
  pending.sort(sortByDue);
  nextWeek.sort(sortByDue);

  const goalTag = `Goal(${now.getFullYear()})`;
  const [taggedGoalTasks, completedTasks, openFilterTasks] = await Promise.all([
    fetchAllGoalTasks(accessToken, goalTag, projects),
    fetchCompletedTasksForProjects(accessToken, projects),
    fetchOpenTasksForProjects(accessToken, projects),
  ]);

  const enrichedTaggedTasks = await enrichTasksWithDetails(accessToken, taggedGoalTasks);
  let taskPool = mergeTasksById(tasks, completedTasks, openFilterTasks);

  const parentIds = new Set(
    enrichedTaggedTasks
      .map((task) => task.parentId)
      .filter((parentId): parentId is string => Boolean(parentId))
  );

  const hierarchyCandidates = taskPool.filter(
    (task) =>
      Boolean(task.parentId) ||
      parentIds.has(task.id) ||
      enrichedTaggedTasks.some((tagged) => tagged.parentId === task.id)
  );

  const enrichedHierarchyTasks = await enrichTasksWithDetails(
    accessToken,
    hierarchyCandidates
  );

  taskPool = mergeTasksById(taskPool, enrichedTaggedTasks, enrichedHierarchyTasks);
  const yearlyGoals = buildYearlyGoals(enrichedTaggedTasks, taskPool, now.getFullYear());

  return {
    weekLabel: monthDayLabel(weekStart, weekEnd),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    calendar,
    doFirst,
    schedule,
    pending,
    nextWeek,
    notes,
    yearlyGoals,
  };
}

export async function createTickTickNote(
  userId: string,
  title: string
): Promise<WeekDashboardTask> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Note text is required');
  }

  const { accessToken } = await loadUserForTickTick(userId);
  const projects =
    (await ticktickFetch<TickTickProject[]>(accessToken, '/project')) || [];

  let notesProject = projects.find((p) => p.name.trim().toLowerCase() === 'notes');

  if (!notesProject) {
    notesProject = await ticktickFetch<TickTickProject>(accessToken, '/project', {
      method: 'POST',
      body: JSON.stringify({ name: 'Notes' }),
    });
  }

  if (!notesProject?.id) {
    throw new ApiError(502, 'Could not find or create a Notes list in TickTick');
  }

  const created = await ticktickFetch<TickTickTask>(accessToken, '/task', {
    method: 'POST',
    body: JSON.stringify({
      title: trimmed,
      projectId: notesProject.id,
    }),
  });

  return toDashboardTask(
    {
      id: created?.id || '',
      projectId: notesProject.id,
      title: created?.title || trimmed,
      priority: created?.priority ?? 0,
      status: created?.status ?? 0,
    },
    parseTickTickDate(created?.dueDate)
  );
}

export async function updateTickTickNote(
  userId: string,
  projectId: string,
  taskId: string,
  title: string
): Promise<WeekDashboardTask> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new ApiError(400, 'Note text is required');
  }
  if (!projectId || !taskId) {
    throw new ApiError(400, 'projectId and taskId are required');
  }

  const { accessToken } = await loadUserForTickTick(userId);

  await ticktickFetch<TickTickTask>(accessToken, `/task/${encodeURIComponent(taskId)}`, {
    method: 'POST',
    body: JSON.stringify({
      id: taskId,
      projectId,
      title: trimmed,
    }),
  });

  return toDashboardTask({
    id: taskId,
    projectId,
    title: trimmed,
    priority: 0,
    status: 0,
  });
}

export async function completeTickTickTask(
  userId: string,
  projectId: string,
  taskId: string
): Promise<void> {
  const { accessToken } = await loadUserForTickTick(userId);
  await ticktickFetch<void>(
    accessToken,
    `/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST' }
  );
}
