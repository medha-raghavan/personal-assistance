import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Link2, AlertCircle } from 'lucide-react';
import { Button, Card } from '../components/common';
import { WeekDashboard } from '../components/ticktick/WeekDashboard';
import { ticktickService } from '../services/ticktick.service';
import { TickTickWeekTask } from '../types';

export function HomeDashboard() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ticktick = searchParams.get('ticktick');
    if (!ticktick) return;

    if (ticktick === 'connected') {
      setBanner('TickTick connected successfully.');
      queryClient.invalidateQueries({ queryKey: ['ticktick'] });
    } else if (ticktick === 'error') {
      setBanner(searchParams.get('message') || 'TickTick connection failed.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('ticktick');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

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

  const connectMutation = useMutation({
    mutationFn: () => ticktickService.getAuthUrl('/'),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (err: Error) => {
      setBanner(err.message || 'Failed to start TickTick connection');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => ticktickService.disconnect(),
    onSuccess: () => {
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
          notes: remove(old.notes),
        };
      });

      return { previous };
    },
    onError: (_err, task, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['ticktick', 'week-dashboard'], context.previous);
      }
      setBanner(`Failed to complete “${task.title}”`);
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
    onError: (err: Error) => {
      setBanner(err.message || 'Failed to add note');
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
          notes: old.notes.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['ticktick', 'week-dashboard'] });
    },
    onError: (err: Error) => {
      setBanner(err.message || 'Failed to update note');
    },
  });

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        Loading dashboard…
      </div>
    );
  }

  if (!statusQuery.data?.configured) {
    return (
      <Card className="max-w-lg mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">TickTick not configured</h1>
        <p className="text-gray-400 text-sm">
          Set <code className="text-gray-200">TICKTICK_CLIENT_ID</code> and{' '}
          <code className="text-gray-200">TICKTICK_CLIENT_SECRET</code> on the backend, then restart
          the API.
        </p>
      </Card>
    );
  }

  if (!statusQuery.data.connected) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        {banner && (
          <div className="rounded-lg bg-amber-900/40 border border-amber-700 text-amber-100 px-4 py-3 text-sm">
            {banner}
          </div>
        )}
        <Card className="p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">This Week</h1>
          <p className="text-gray-400 text-sm">
            Connect your TickTick account to see calendar, priorities, pending tasks, and notes.
          </p>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="inline-flex items-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            {connectMutation.isPending ? 'Redirecting…' : 'Connect TickTick'}
          </Button>
        </Card>
      </div>
    );
  }

  if (weekQuery.isLoading || !weekQuery.data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        Loading TickTick week…
      </div>
    );
  }

  if (weekQuery.isError) {
    return (
      <Card className="max-w-lg mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Failed to load TickTick data</h1>
        <p className="text-gray-400 text-sm">
          {(weekQuery.error as Error)?.message || 'Unknown error'}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => weekQuery.refetch()}>Retry</Button>
          <Button variant="secondary" onClick={() => disconnectMutation.mutate()}>
            Disconnect
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {banner && (
        <div className="mb-4 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-100 px-4 py-3 text-sm">
          {banner}
        </div>
      )}
      <WeekDashboard
        data={weekQuery.data}
        syncing={weekQuery.isFetching}
        onRefresh={() => weekQuery.refetch()}
        onDisconnect={() => disconnectMutation.mutate()}
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
      />
    </div>
  );
}
