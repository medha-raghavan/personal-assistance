import { useMemo, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  TickTickWeekDashboard,
  TickTickWeekTask,
  TickTickYearlyGoal,
} from '../../services/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  ink: '#2B2620',
  inkSoft: '#8A8071',
  inkDim: '#A39A89',
  paper: '#F4EFE3',
  pink: '#F6D9D3',
  blue: '#DCE3EC',
  yellow: '#F3E4B8',
  green: '#DCE8D6',
  tan: '#F0D9B8',
  gray: '#DEE2E6',
  purple: '#E3DCEF',
  tapeCal: '#8B8378',
  tapePink: '#C96B57',
  tapeBlue: '#6E7F94',
  tapeYellow: '#C79A3E',
  tapeGreen: '#6E8F5F',
  tapeTan: '#C67A3E',
  tapeGray: '#6E7F94',
  tapePurple: '#8A78A8',
};

type CardId =
  | 'calendar'
  | 'doFirst'
  | 'schedule'
  | 'pending'
  | 'meal'
  | 'nextWeek'
  | 'notes'
  | 'goals';

function PlanCard({
  id,
  title,
  icon,
  bg,
  tape,
  open,
  onToggle,
  children,
}: {
  id: CardId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  tape: string;
  open: boolean;
  onToggle: (id: CardId) => void;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: -6,
          left: '50%',
          marginLeft: -26,
          width: 52,
          height: 16,
          borderRadius: 2,
          backgroundColor: tape,
          opacity: 0.75,
          transform: [{ rotate: '-3deg' }],
        }}
      />
      <TouchableOpacity
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onToggle(id);
        }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={icon} size={18} color={COLORS.ink} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.ink }}>{title}</Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            color: '#6B6355',
            transform: [{ rotate: open ? '180deg' : '0deg' }],
          }}
        >
          ▾
        </Text>
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

function TaskRow({
  task,
  completing,
  onComplete,
  meta,
}: {
  task: TickTickWeekTask;
  completing?: boolean;
  onComplete?: (task: TickTickWeekTask) => void;
  meta?: string;
}) {
  return (
    <TouchableOpacity
      disabled={!onComplete || completing}
      onPress={() => onComplete?.(task)}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        paddingVertical: 6,
        opacity: completing ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 1.5,
            borderColor: COLORS.inkSoft,
            marginTop: 1,
            backgroundColor: completing ? COLORS.inkSoft : 'transparent',
          }}
        />
        <Text style={{ fontSize: 12.5, color: COLORS.ink, flex: 1 }}>{task.title}</Text>
      </View>
      {meta ? (
        <Text style={{ fontSize: 10, color: COLORS.inkSoft, flexShrink: 0 }}>{meta}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function GoalRow({ goal }: { goal: TickTickYearlyGoal }) {
  const pct = Math.max(0, Math.min(100, Math.round(goal.progress)));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12.5, color: COLORS.ink, flex: 1, fontWeight: '600' }}>
          {goal.title}
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.inkSoft }}>
          {goal.completed}/{goal.total}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: goal.goalCompleted ? '#6E8F5F' : '#8A78A8',
          }}
        />
      </View>
    </View>
  );
}

export interface WeekPlannerProps {
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
  shellBg: string;
  textColor: string;
  dimColor: string;
}

export function WeekPlanner({
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
  shellBg,
  textColor,
  dimColor,
}: WeekPlannerProps) {
  const [open, setOpen] = useState<Record<CardId, boolean>>({
    calendar: false,
    doFirst: true,
    schedule: false,
    pending: true,
    meal: false,
    nextWeek: false,
    notes: false,
    goals: false,
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const emptyDays = useMemo(() => {
    const empty = data.calendar.filter((d) => d.events.length === 0).map((d) => d.day);
    return empty.length ? `${empty.join(', ')} — nothing scheduled` : null;
  }, [data.calendar]);

  const toggle = (id: CardId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const isCompleting = (id: string) => completingIds?.has(id);

  const submitNote = async () => {
    const title = noteDraft.trim();
    if (!title || !onAddNote || addingNote) return;
    await onAddNote(title);
    setNoteDraft('');
  };

  const saveEdit = async (note: TickTickWeekTask) => {
    const title = editDraft.trim();
    if (!title || !onEditNote || editingNoteId) return;
    await onEditNote(note, title);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: shellBg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: textColor, fontSize: 24, fontWeight: '800' }}>This Week</Text>
          <Text style={{ color: dimColor, fontSize: 11.5, marginTop: 2 }}>{data.weekLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={syncing}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: '#242938',
              backgroundColor: '#171B24',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#8B93A3" />
            ) : (
              <Ionicons name="sync-outline" size={12} color="#8B93A3" />
            )}
            <Text style={{ fontSize: 10.5, color: '#8B93A3' }}>
              {syncing ? 'Syncing' : 'TickTick'}
            </Text>
          </TouchableOpacity>
          {onDisconnect ? (
            <TouchableOpacity
              onPress={onDisconnect}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 100,
                borderWidth: 1,
                borderColor: '#242938',
                backgroundColor: '#171B24',
              }}
            >
              <Ionicons name="unlink-outline" size={14} color="#8B93A3" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 14 }}>
        <PlanCard
          id="calendar"
          title="Calendar"
          icon="calendar-outline"
          bg={COLORS.paper}
          tape={COLORS.tapeCal}
          open={open.calendar}
          onToggle={toggle}
        >
          {data.calendar
            .filter((d) => d.events.length > 0)
            .map((d) => (
              <View
                key={`${d.day}-${d.date}`}
                style={{
                  paddingVertical: 6,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.1)',
                  borderStyle: 'dashed',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.ink }}>
                  {d.day} {d.date}
                  {d.flag ? ' 🎉' : ''}
                </Text>
                {d.events.map((e, i) => (
                  <Text key={i} style={{ fontSize: 12.5, color: '#3A342A', marginTop: 2 }}>
                    · {e}
                  </Text>
                ))}
              </View>
            ))}
          {emptyDays ? (
            <Text style={{ fontSize: 12, color: COLORS.inkDim, paddingTop: 6 }}>{emptyDays}</Text>
          ) : null}
          {data.calendar.every((d) => d.events.length === 0) ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Nothing on the calendar</Text>
          ) : null}
        </PlanCard>

        <PlanCard
          id="doFirst"
          title="Do First"
          icon="warning-outline"
          bg={COLORS.pink}
          tape={COLORS.tapePink}
          open={open.doFirst}
          onToggle={toggle}
        >
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 0.4,
              color: COLORS.inkSoft,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Urgent & important
          </Text>
          {data.doFirst.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No tasks</Text>
          ) : (
            data.doFirst.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                completing={isCompleting(t.id)}
                onComplete={onCompleteTask}
                meta={t.pendingSinceLabel || t.dueLabel}
              />
            ))
          )}
        </PlanCard>

        <PlanCard
          id="schedule"
          title="Schedule"
          icon="time-outline"
          bg={COLORS.blue}
          tape={COLORS.tapeBlue}
          open={open.schedule}
          onToggle={toggle}
        >
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 0.4,
              color: COLORS.inkSoft,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            This week · not urgent & important
          </Text>
          {data.schedule.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No tasks</Text>
          ) : (
            data.schedule.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                completing={isCompleting(t.id)}
                onComplete={onCompleteTask}
                meta={t.dueLabel}
              />
            ))
          )}
        </PlanCard>

        <PlanCard
          id="pending"
          title="Pending Tasks"
          icon="list-outline"
          bg={COLORS.yellow}
          tape={COLORS.tapeYellow}
          open={open.pending}
          onToggle={toggle}
        >
          {data.pending.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No tasks</Text>
          ) : (
            data.pending.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                completing={isCompleting(t.id)}
                onComplete={onCompleteTask}
                meta={t.pendingSinceLabel || t.dueLabel}
              />
            ))
          )}
        </PlanCard>

        <PlanCard
          id="meal"
          title="Meal Plan"
          icon="restaurant-outline"
          bg={COLORS.green}
          tape={COLORS.tapeGreen}
          open={open.meal}
          onToggle={toggle}
        >
          <Text style={{ fontSize: 12.5, color: '#5C5647', fontStyle: 'italic' }}>Coming soon</Text>
        </PlanCard>

        <PlanCard
          id="nextWeek"
          title="Next Week"
          icon="calendar-number-outline"
          bg={COLORS.tan}
          tape={COLORS.tapeTan}
          open={open.nextWeek}
          onToggle={toggle}
        >
          {data.nextWeek.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No tasks</Text>
          ) : (
            data.nextWeek.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                completing={isCompleting(t.id)}
                onComplete={onCompleteTask}
                meta={t.dueLabel}
              />
            ))
          )}
        </PlanCard>

        <PlanCard
          id="notes"
          title="Notes"
          icon="document-text-outline"
          bg={COLORS.gray}
          tape={COLORS.tapeGray}
          open={open.notes}
          onToggle={toggle}
        >
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Add a note…"
              placeholderTextColor={COLORS.inkSoft}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.15)',
                borderRadius: 8,
                paddingHorizontal: 11,
                paddingVertical: 9,
                fontSize: 12.5,
                backgroundColor: 'rgba(255,255,255,0.5)',
                color: COLORS.ink,
              }}
              onSubmitEditing={submitNote}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={submitNote}
              disabled={addingNote || !noteDraft.trim()}
              style={{
                backgroundColor: 'rgba(0,0,0,0.65)',
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 8,
                opacity: addingNote || !noteDraft.trim() ? 0.5 : 1,
                justifyContent: 'center',
              }}
            >
              {addingNote ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
          {data.notes.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No notes yet</Text>
          ) : (
            data.notes.map((note) =>
              editingId === note.id ? (
                <View key={note.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                  <TextInput
                    value={editDraft}
                    onChangeText={setEditDraft}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.15)',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      fontSize: 12.5,
                      color: COLORS.ink,
                      backgroundColor: 'rgba(255,255,255,0.6)',
                    }}
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => saveEdit(note)}
                    disabled={!!editingNoteId}
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingId(null);
                      setEditDraft('');
                    }}
                    style={{ justifyContent: 'center', paddingHorizontal: 6 }}
                  >
                    <Text style={{ color: COLORS.inkSoft, fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  key={note.id}
                  onPress={() => {
                    if (!onEditNote) return;
                    setEditingId(note.id);
                    setEditDraft(note.title);
                  }}
                  style={{ paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 12, color: '#3A342A' }}>– {note.title}</Text>
                </TouchableOpacity>
              )
            )
          )}
        </PlanCard>

        <PlanCard
          id="goals"
          title="Yearly Goals"
          icon="flag-outline"
          bg={COLORS.purple}
          tape={COLORS.tapePurple}
          open={open.goals}
          onToggle={toggle}
        >
          {data.yearlyGoals.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: COLORS.inkSoft }}>
              No goals tagged for this year
            </Text>
          ) : (
            data.yearlyGoals.map((g) => <GoalRow key={g.id} goal={g} />)
          )}
        </PlanCard>
      </View>
    </View>
  );
}
