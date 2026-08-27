import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  Clock3,
  ListChecks,
  Utensils,
  CalendarClock,
  StickyNote,
  Target,
  ChevronDown,
  Circle,
  CheckCircle2,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import { TickTickWeekDashboard, TickTickWeekTask } from '../../types';

const COLORS = {
  board: '#1E1A17',
  boardGrain: '#151210',
  paper: '#FBF7ED',
  paperLine: '#D8C9A8',
  ink: '#2B2622',
  inkSoft: '#6B5F52',
  urgent: '#C0553B',
  urgentBg: '#F5DCD3',
  schedule: '#4E6C82',
  scheduleBg: '#DCE6EA',
  tasks: '#B98B2E',
  tasksBg: '#F3E3B8',
  meal: '#5E7A55',
  mealBg: '#DCE7D3',
  nextweek: '#B0602E',
  nextweekBg: '#F0DCC4',
  notes: '#5B6B72',
  notesBg: '#DCE3E3',
  goals: '#6B5F8A',
  goalsBg: '#E4E0F0',
  calendar: '#4A4640',
};

const SCROLL_CSS = `
.scroll-pane{scrollbar-width:thin;scrollbar-color:#8a7c68 transparent;}
.scroll-pane::-webkit-scrollbar{width:6px;}
.scroll-pane::-webkit-scrollbar-track{background:transparent;}
.scroll-pane::-webkit-scrollbar-thumb{background:#8a7c68;border-radius:3px;}
`;

function Tape({
  color,
  rotate = 0,
  left = '50%',
}: {
  color: string;
  rotate?: number;
  left?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: -12,
        left,
        transform: `translateX(-50%) rotate(${rotate}deg)`,
        width: 64,
        height: 22,
        background: color,
        opacity: 0.85,
        boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
      }}
    />
  );
}

function Card({
  id,
  title,
  icon,
  accent,
  bg,
  rotate,
  open,
  onToggle,
  children,
  tapeLeft,
  scrollHeight,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  rotate: number;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  tapeLeft?: string;
  scrollHeight?: number;
}) {
  const collapseMax = scrollHeight ? scrollHeight + 80 : 600;
  return (
    <div
      style={{
        position: 'relative',
        background: bg,
        transform: `rotate(${open ? 0 : rotate}deg)`,
        transition: 'transform 0.3s ease',
        boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.4) inset',
      }}
      className="rounded-sm"
    >
      <Tape color={accent} rotate={rotate > 0 ? -6 : 6} left={tapeLeft || '50%'} />
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between gap-2 px-4 pt-4 pb-2 text-left"
        style={{ fontFamily: "'Kalam', cursive" }}
      >
        <span className="flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          <span style={{ color: COLORS.ink, fontSize: 19, fontWeight: 700, letterSpacing: 0.3 }}>
            {title}
          </span>
        </span>
        <ChevronDown
          size={18}
          style={{
            color: accent,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
            flexShrink: 0,
          }}
        />
      </button>
      <div
        style={{
          maxHeight: open ? collapseMax : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease',
        }}
      >
        <div
          className={scrollHeight ? 'px-4 pb-4 pt-1 scroll-pane' : 'px-4 pb-4 pt-1'}
          style={scrollHeight ? { maxHeight: scrollHeight, overflowY: 'auto' } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Divider({ color }: { color: string }) {
  return <div style={{ height: 1, background: color, opacity: 0.35, margin: '6px 0' }} />;
}

function TaskRow({
  task,
  accent,
  completing,
  onComplete,
  showDue,
  showPendingSince,
}: {
  task: TickTickWeekTask;
  accent: string;
  completing?: boolean;
  onComplete?: (task: TickTickWeekTask) => void;
  showDue?: boolean;
  showPendingSince?: boolean;
}) {
  const mono = { fontFamily: "'Space Mono', monospace" };
  const interactive = Boolean(onComplete);
  const meta = showPendingSince
    ? task.pendingSinceLabel || task.dueLabel
    : showDue
      ? task.dueLabel
      : undefined;

  return (
    <li className="flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={!interactive || completing}
        onClick={() => onComplete?.(task)}
        className="flex items-start gap-2 text-left flex-1 min-w-0 disabled:opacity-60"
      >
        {completing ? (
          <CheckCircle2 size={14} style={{ color: accent, marginTop: 3, flexShrink: 0 }} />
        ) : (
          <Circle size={14} style={{ color: accent, marginTop: 3, flexShrink: 0 }} />
        )}
        <span style={{ ...mono, color: COLORS.ink, fontSize: 13 }}>{task.title}</span>
      </button>
      {meta && (
        <span style={{ ...mono, color: COLORS.inkSoft, fontSize: 10, flexShrink: 0 }}>
          {meta}
        </span>
      )}
    </li>
  );
}

export interface WeekDashboardProps {
  data: TickTickWeekDashboard;
  syncing?: boolean;
  onRefresh: () => void;
  onDisconnect?: () => void;
  onCompleteTask: (task: TickTickWeekTask) => void;
  onAddNote?: (title: string) => Promise<void> | void;
  onEditNote?: (note: TickTickWeekTask, title: string) => Promise<void> | void;
  addingNote?: boolean;
  editingNoteId?: string | null;
  completingIds?: Set<string>;
}

export function WeekDashboard({
  data,
  syncing,
  onRefresh,
  onDisconnect,
  onCompleteTask,
  onAddNote,
  onEditNote,
  addingNote,
  editingNoteId,
  completingIds,
}: WeekDashboardProps) {
  const [open, setOpen] = useState({
    calendar: true,
    priority: true,
    tasks: true,
    meal: true,
    nextweek: true,
    notes: true,
    goals: true,
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const toggle = (id: string) =>
    setOpen((o) => ({ ...o, [id]: !o[id as keyof typeof o] }));

  const mono = { fontFamily: "'Space Mono', monospace" };
  const hand = { fontFamily: "'Kalam', cursive" };

  const isCompleting = (id: string) => completingIds?.has(id);

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = noteDraft.trim();
    if (!title || !onAddNote || addingNote) return;
    await onAddNote(title);
    setNoteDraft('');
  };

  const startEdit = (note: TickTickWeekTask) => {
    if (!onEditNote) return;
    setEditingId(note.id);
    setEditDraft(note.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async (note: TickTickWeekTask) => {
    const title = editDraft.trim();
    if (!title || !onEditNote || editingNoteId) return;
    await onEditNote(note, title);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div
      style={{
        background: `radial-gradient(circle at 20% 10%, ${COLORS.boardGrain}, ${COLORS.board} 70%)`,
        minHeight: '100%',
        margin: '-1rem -1rem -1.5rem',
        padding: '28px 18px 40px',
      }}
      className="sm:!-m-6"
    >
      <style>{SCROLL_CSS}</style>

      <div className="flex items-center justify-between mb-6 px-2 gap-3 flex-wrap">
        <div>
          <div style={{ ...hand, color: COLORS.paper, fontSize: 28, fontWeight: 700 }}>
            This Week
          </div>
          <div style={{ ...mono, color: '#a89f8f', fontSize: 11, letterSpacing: 1 }}>
            {data.weekLabel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full disabled:opacity-60"
            style={{ background: 'rgba(255,255,255,0.08)', ...mono, color: '#c9c0b0', fontSize: 11 }}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Synced with TickTick'}
          </button>
          {onDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', ...mono, color: '#c9c0b0', fontSize: 11 }}
              title="Disconnect TickTick"
            >
              <Unplug size={12} />
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <Card
              id="calendar"
              title="Calendar"
              icon={<Calendar size={18} />}
              accent={COLORS.calendar}
              bg={COLORS.paper}
              rotate={-1}
              scrollHeight={560}
              open={open.calendar}
              onToggle={toggle}
            >
              <div className="flex flex-col">
                {data.calendar.map((d, idx) => (
                  <div key={`${d.day}-${d.date}`} className={idx !== 0 ? 'pt-3' : ''}>
                    <div className="flex items-baseline gap-1.5">
                      <span style={{ ...hand, color: COLORS.ink, fontSize: 16, fontWeight: 700 }}>
                        {d.day}
                      </span>
                      <span style={{ ...mono, color: COLORS.inkSoft, fontSize: 10 }}>{d.date}</span>
                      {d.flag && <span style={{ fontSize: 11 }}>🎉</span>}
                    </div>
                    <Divider color={COLORS.paperLine} />
                    {d.events.length === 0 ? (
                      <div style={{ ...mono, color: COLORS.inkSoft, fontSize: 12, lineHeight: 1.6 }}>
                        · —
                      </div>
                    ) : (
                      d.events.map((e, i) => (
                        <div
                          key={i}
                          style={{ ...mono, color: COLORS.inkSoft, fontSize: 12, lineHeight: 1.6 }}
                        >
                          · {e}
                        </div>
                      ))
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6" style={{ flex: '1 1 0%', minWidth: 0 }}>
            <Card
              id="priority-urgent"
              title="Do First"
              icon={<AlertTriangle size={18} />}
              accent={COLORS.urgent}
              bg={COLORS.urgentBg}
              rotate={1}
              tapeLeft="40%"
              scrollHeight={130}
              open={open.priority}
              onToggle={() => toggle('priority')}
            >
              <div style={{ ...mono, color: COLORS.inkSoft, fontSize: 10, marginBottom: 6 }}>
                URGENT &amp; IMPORTANT
              </div>
              <ul className="space-y-2">
                {data.doFirst.length === 0 && (
                  <li style={{ ...mono, color: COLORS.inkSoft, fontSize: 12 }}>No tasks</li>
                )}
                {data.doFirst.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    accent={COLORS.urgent}
                    completing={isCompleting(t.id)}
                    onComplete={onCompleteTask}
                    showPendingSince
                  />
                ))}
              </ul>
            </Card>

            <Card
              id="priority-schedule"
              title="Schedule"
              icon={<Clock3 size={18} />}
              accent={COLORS.schedule}
              bg={COLORS.scheduleBg}
              rotate={-1}
              tapeLeft="60%"
              scrollHeight={130}
              open={open.priority}
              onToggle={() => toggle('priority')}
            >
              <div style={{ ...mono, color: COLORS.inkSoft, fontSize: 10, marginBottom: 6 }}>
                THIS WEEK · NOT URGENT &amp; IMPORTANT
              </div>
              <ul className="space-y-2">
                {data.schedule.length === 0 && (
                  <li style={{ ...mono, color: COLORS.inkSoft, fontSize: 12 }}>No tasks</li>
                )}
                {data.schedule.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    accent={COLORS.schedule}
                    completing={isCompleting(t.id)}
                    onComplete={onCompleteTask}
                    showDue
                  />
                ))}
              </ul>
            </Card>

            <Card
              id="tasks"
              title="Pending Tasks"
              icon={<ListChecks size={18} />}
              accent={COLORS.tasks}
              bg={COLORS.tasksBg}
              rotate={0.8}
              tapeLeft="45%"
              scrollHeight={160}
              open={open.tasks}
              onToggle={toggle}
            >
              <ul className="space-y-2">
                {data.pending.length === 0 && (
                  <li style={{ ...mono, color: COLORS.inkSoft, fontSize: 12 }}>No tasks</li>
                )}
                {data.pending.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    accent={COLORS.tasks}
                    completing={isCompleting(t.id)}
                    onComplete={onCompleteTask}
                    showPendingSince
                  />
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <Card
          id="meal"
          title="Meal Plan"
          icon={<Utensils size={18} />}
          accent={COLORS.meal}
          bg={COLORS.mealBg}
          rotate={-0.8}
          open={open.meal}
          onToggle={toggle}
        >
          <div style={{ ...mono, color: COLORS.inkSoft, fontSize: 12, padding: '8px 0' }}>
            Coming soon
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            id="nextweek"
            title="Next Week"
            icon={<CalendarClock size={18} />}
            accent={COLORS.nextweek}
            bg={COLORS.nextweekBg}
            rotate={-1.3}
            tapeLeft="35%"
            open={open.nextweek}
            onToggle={toggle}
          >
            <ul className="space-y-2">
              {data.nextWeek.length === 0 && (
                <li style={{ ...mono, color: COLORS.inkSoft, fontSize: 12 }}>No tasks</li>
              )}
              {data.nextWeek.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <span style={{ color: COLORS.nextweek, fontSize: 13 }}>·</span>
                  <span style={{ ...mono, color: COLORS.ink, fontSize: 13 }}>{t.title}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            id="notes"
            title="Notes"
            icon={<StickyNote size={18} />}
            accent={COLORS.notes}
            bg={COLORS.notesBg}
            rotate={1.4}
            tapeLeft="65%"
            open={open.notes}
            onToggle={toggle}
          >
            {onAddNote && (
              <form onSubmit={submitNote} className="flex gap-2 mb-3">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Add a note…"
                  disabled={addingNote}
                  style={{
                    ...mono,
                    flex: 1,
                    fontSize: 12,
                    color: COLORS.ink,
                    background: 'rgba(255,255,255,0.55)',
                    border: `1px solid ${COLORS.paperLine}`,
                    borderRadius: 4,
                    padding: '6px 8px',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={addingNote || !noteDraft.trim()}
                  style={{
                    ...mono,
                    fontSize: 11,
                    color: '#fff',
                    background: COLORS.notes,
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 10px',
                    opacity: addingNote || !noteDraft.trim() ? 0.5 : 1,
                    cursor: addingNote || !noteDraft.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {addingNote ? '…' : 'Add'}
                </button>
              </form>
            )}
            <ul className="space-y-2">
              {data.notes.length === 0 && (
                <li style={{ ...mono, color: COLORS.inkSoft, fontSize: 12 }}>
                  No notes yet
                </li>
              )}
              {data.notes.map((n) => (
                <li key={n.id} style={{ ...mono, color: COLORS.ink, fontSize: 12, lineHeight: 1.5 }}>
                  {editingId === n.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        disabled={editingNoteId === n.id}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveEdit(n);
                          }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        style={{
                          ...mono,
                          flex: 1,
                          fontSize: 12,
                          color: COLORS.ink,
                          background: 'rgba(255,255,255,0.55)',
                          border: `1px solid ${COLORS.paperLine}`,
                          borderRadius: 4,
                          padding: '4px 6px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void saveEdit(n)}
                        disabled={editingNoteId === n.id || !editDraft.trim()}
                        style={{
                          ...mono,
                          fontSize: 10,
                          color: '#fff',
                          background: COLORS.notes,
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          opacity: editingNoteId === n.id || !editDraft.trim() ? 0.5 : 1,
                        }}
                      >
                        {editingNoteId === n.id ? '…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={editingNoteId === n.id}
                        style={{
                          ...mono,
                          fontSize: 10,
                          color: COLORS.inkSoft,
                          background: 'transparent',
                          border: `1px solid ${COLORS.paperLine}`,
                          borderRadius: 4,
                          padding: '4px 8px',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="text-left w-full hover:opacity-80"
                      style={{ ...mono, color: COLORS.ink, fontSize: 12, lineHeight: 1.5 }}
                      title={onEditNote ? 'Click to edit' : undefined}
                    >
                      — {n.title}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card
          id="goals"
          title="Yearly Goals"
          icon={<Target size={18} />}
          accent={COLORS.goals}
          bg={COLORS.goalsBg}
          rotate={-0.6}
          tapeLeft="50%"
          open={open.goals}
          onToggle={toggle}
        >
          {(data.yearlyGoals ?? []).length === 0 ? (
            <div style={{ ...mono, color: COLORS.inkSoft, fontSize: 12, padding: '8px 0' }}>
              No goals tagged Goal({new Date().getFullYear()})
            </div>
          ) : (
            <ul className="space-y-4">
              {(data.yearlyGoals ?? []).map((goal) => (
                <li key={goal.id}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span style={{ ...mono, color: COLORS.ink, fontSize: 13 }}>{goal.title}</span>
                    <span style={{ ...mono, color: COLORS.inkSoft, fontSize: 11, flexShrink: 0 }}>
                      {goal.progress}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'rgba(43, 38, 34, 0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${goal.progress}%`,
                        background: COLORS.goals,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
