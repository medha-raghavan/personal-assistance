import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ticktickService, TickTickWeekTask } from '../../services/api';
import { useTheme } from '../../components/ThemeProvider';
import { WeekPlanner } from '../../components/ticktick/WeekPlanner';

export default function HomeDashboardScreen() {
  const queryClient = useQueryClient();
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);

  const shellBg = isDark ? '#0B0D12' : colors.background;
  const textColor = isDark ? '#E7E9EE' : colors.text;
  const dimColor = isDark ? '#5B6273' : colors.textMuted;

  const statusQuery = useQuery({
    queryKey: ['ticktick', 'status'],
    queryFn: () => ticktickService.getStatus(),
  });

  const weekQuery = useQuery({
    queryKey: ['ticktick', 'week-dashboard'],
    queryFn: () => ticktickService.getWeekDashboard(),
    enabled: Boolean(statusQuery.data?.connected),
    staleTime: 60_000,
  });

  const refreshOnForeground = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ticktick'] });
  }, [queryClient]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshOnForeground();
    });
    return () => sub.remove();
  }, [refreshOnForeground]);

  useFocusEffect(
    useCallback(() => {
      refreshOnForeground();
    }, [refreshOnForeground])
  );

  const connectMutation = useMutation({
    mutationFn: () => ticktickService.getAuthUrl('mobile'),
    onSuccess: async (url) => {
      await Linking.openURL(url);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error?.message || err.message || 'Failed to start TickTick connection');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => ticktickService.disconnect(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['ticktick', 'week-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ticktick'] });
      setBanner('TickTick disconnected.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (task: TickTickWeekTask) =>
      ticktickService.completeTask(task.projectId, task.id),
    onMutate: async (task) => {
      setCompletingIds((prev) => new Set(prev).add(task.id));
      await queryClient.cancelQueries({ queryKey: ['ticktick', 'week-dashboard'] });
      const previous = queryClient.getQueryData(['ticktick', 'week-dashboard']);
      queryClient.setQueryData(['ticktick', 'week-dashboard'], (old: typeof weekQuery.data) => {
        if (!old) return old;
        const remove = <T extends { id: string }>(arr: T[]) => arr.filter((t) => t.id !== task.id);
        return {
          ...old,
          doFirst: remove(old.doFirst),
          schedule: remove(old.schedule),
          pending: remove(old.pending),
          nextWeek: remove(old.nextWeek),
        };
      });
      return { previous };
    },
    onError: (_err, task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['ticktick', 'week-dashboard'], context.previous);
      }
      Alert.alert('Error', `Failed to complete “${task.title}”`);
    },
    onSettled: (_data, _err, task) => {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['ticktick', 'week-dashboard'] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (title: string) => ticktickService.createNote(title),
    onSuccess: (note) => {
      queryClient.setQueryData(['ticktick', 'week-dashboard'], (old: typeof weekQuery.data) => {
        if (!old) return old;
        return { ...old, notes: [note, ...old.notes] };
      });
      queryClient.invalidateQueries({ queryKey: ['ticktick', 'week-dashboard'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to add note');
    },
  });

  const editNoteMutation = useMutation({
    mutationFn: ({ note, title }: { note: TickTickWeekTask; title: string }) =>
      ticktickService.updateNote(note.projectId, note.id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData(['ticktick', 'week-dashboard'], (old: typeof weekQuery.data) => {
        if (!old) return old;
        return {
          ...old,
          notes: old.notes.map((n) => (n.id === updated.id ? updated : n)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['ticktick', 'week-dashboard'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.error?.message || 'Failed to update note');
    },
  });

  const handleDisconnect = () => {
    Alert.alert('Disconnect TickTick', 'Stop syncing your TickTick account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => disconnectMutation.mutate(),
      },
    ]);
  };

  if (statusQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: shellBg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <ActivityIndicator color="#7C8CF0" />
      </View>
    );
  }

  if (statusQuery.data && !statusQuery.data.configured) {
    return (
      <View style={{ flex: 1, backgroundColor: shellBg, padding: 24, paddingTop: insets.top + 24, justifyContent: 'center' }}>
        <Text style={{ color: textColor, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>This Week</Text>
        <Text style={{ color: dimColor, fontSize: 14, lineHeight: 20 }}>
          TickTick OAuth is not configured on the server. Add TickTick credentials to enable the week planner.
        </Text>
      </View>
    );
  }

  if (!statusQuery.data?.connected) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: shellBg }}
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, flexGrow: 1, justifyContent: 'center' }}
        refreshControl={
          <RefreshControl
            refreshing={statusQuery.isFetching}
            onRefresh={() => statusQuery.refetch()}
            tintColor="#7C8CF0"
          />
        }
      >
        {banner ? (
          <View
            style={{
              backgroundColor: '#3B2C10',
              borderColor: '#E8A33D',
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#E8A33D', fontSize: 13 }}>{banner}</Text>
          </View>
        ) : null}
        <View
          style={{
            backgroundColor: isDark ? '#12151C' : colors.card,
            borderRadius: 16,
            padding: 28,
            borderWidth: 1,
            borderColor: isDark ? '#242938' : colors.border,
            alignItems: 'center',
          }}
        >
          <Ionicons name="calendar-outline" size={40} color="#7C8CF0" />
          <Text style={{ color: textColor, fontSize: 22, fontWeight: '800', marginTop: 12 }}>This Week</Text>
          <Text style={{ color: dimColor, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
            Connect your TickTick account to see calendar, priorities, pending tasks, and notes.
          </Text>
          <TouchableOpacity
            onPress={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            style={{
              marginTop: 20,
              backgroundColor: '#7C8CF0',
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              opacity: connectMutation.isPending ? 0.7 : 1,
            }}
          >
            {connectMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="link-outline" size={18} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {connectMutation.isPending ? 'Redirecting…' : 'Connect TickTick'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (weekQuery.isLoading || !weekQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: shellBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C8CF0" />
        <Text style={{ color: dimColor, marginTop: 12 }}>Loading TickTick week…</Text>
      </View>
    );
  }

  if (weekQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: shellBg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="alert-circle-outline" size={40} color="#F0654A" />
        <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', marginTop: 12 }}>
          Failed to load TickTick data
        </Text>
        <Text style={{ color: dimColor, textAlign: 'center', marginTop: 8 }}>
          {(weekQuery.error as Error)?.message || 'Unknown error'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <TouchableOpacity
            onPress={() => weekQuery.refetch()}
            style={{ backgroundColor: '#7C8CF0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDisconnect}
            style={{
              backgroundColor: '#171B24',
              borderWidth: 1,
              borderColor: '#242938',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#8B93A3', fontWeight: '600' }}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: shellBg }}
      contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
      refreshControl={
        <RefreshControl
          refreshing={weekQuery.isFetching && !weekQuery.isLoading}
          onRefresh={() => weekQuery.refetch()}
          tintColor="#7C8CF0"
        />
      }
    >
      {banner ? (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            backgroundColor: '#173C33',
            borderColor: '#2DD4A7',
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
          }}
        >
          <Text style={{ color: '#2DD4A7', fontSize: 13 }}>{banner}</Text>
        </View>
      ) : null}
      <WeekPlanner
        data={weekQuery.data}
        syncing={weekQuery.isFetching}
        onRefresh={() => weekQuery.refetch()}
        onDisconnect={handleDisconnect}
        onCompleteTask={(task) => completeMutation.mutate(task)}
        onAddNote={async (title) => {
          await addNoteMutation.mutateAsync(title);
        }}
        onEditNote={async (note, title) => {
          await editNoteMutation.mutateAsync({ note, title });
        }}
        addingNote={addNoteMutation.isPending}
        editingNoteId={editNoteMutation.isPending ? editNoteMutation.variables?.note.id ?? null : null}
        completingIds={completingIds}
        shellBg={shellBg}
        textColor={textColor}
        dimColor={dimColor}
      />
    </ScrollView>
  );
}
