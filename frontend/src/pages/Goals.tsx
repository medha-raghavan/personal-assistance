import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Target,
  Landmark,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, Button, Input, Modal, Badge, Select } from '../components/common';
import { goalService } from '../services/goal.service';
import {
  GoalDetail,
  GoalListItem,
  GoalType,
  CreateGoalPayload,
} from '../types';
import { formatCurrency, formatCompactNumber, formatDate } from '../utils/formatters';
import {
  calculateEmi,
  sipFvAtMonths,
  suggestTagFromName,
  normalizeTag,
} from '../utils/goalCalculations';

const TYPE_LABELS: Record<GoalType, string> = {
  goal: 'Goal',
  loan: 'Loan',
  sip: 'SIP',
};

const TYPE_BADGE: Record<GoalType, 'info' | 'warning' | 'success'> = {
  goal: 'info',
  loan: 'warning',
  sip: 'success',
};

function TypeIcon({ type, className }: { type: GoalType; className?: string }) {
  if (type === 'loan') return <Landmark className={className} />;
  if (type === 'sip') return <TrendingUp className={className} />;
  return <Target className={className} />;
}

export function Goals() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: goals = [], isLoading, refetch } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalService.getAll(),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setExpandedId(null);
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Goals & Planning</h1>
          <p className="text-sm sm:text-base text-gray-400">
            Track savings goals, loans, and SIPs via transaction tags
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setShowAddModal(true)}
          size="sm"
          className="self-start sm:self-auto"
        >
          Add Goal
        </Button>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {isLoading ? (
          <Card className="text-center py-12 text-gray-400">Loading...</Card>
        ) : goals.length === 0 ? (
          <Card className="text-center py-12">
            <Target className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              No goals yet. Create a goal, loan, or SIP and tag matching transactions.
            </p>
            <Button onClick={() => setShowAddModal(true)}>Add Goal</Button>
          </Card>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              expanded={expandedId === goal._id}
              onToggle={() =>
                setExpandedId((id) => (id === goal._id ? null : goal._id))
              }
              onDelete={() => {
                if (confirm(`Delete “${goal.name}”? Tagged transactions are kept.`)) {
                  deleteMutation.mutate(goal._id);
                }
              }}
              onRefetchList={() => refetch()}
            />
          ))
        )}
      </div>

      <AddGoalModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

function GoalCard({
  goal,
  expanded,
  onToggle,
  onDelete,
  onRefetchList,
}: {
  goal: GoalListItem;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRefetchList: () => void;
}) {
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['goals', goal._id],
    queryFn: () => goalService.getById(goal._id),
    enabled: expanded,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (detail) onRefetchList();
    // Refresh list progress when detail loads (live sums)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.progress?.summaryAmount]);

  const progress = detail?.progress ?? goal.progress;
  const percent = progress.progressPercent ?? 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-start gap-3 sm:gap-4"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-primary-400 shrink-0">
          <TypeIcon type={goal.type} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-white truncate">{goal.name}</h3>
            <Badge variant={TYPE_BADGE[goal.type]} size="sm">
              {TYPE_LABELS[goal.type]}
            </Badge>
            <Badge size="sm">{goal.tag}</Badge>
            {progress.isOpenEnded && (
              <Badge variant="info" size="sm">
                Ongoing
              </Badge>
            )}
            {progress.isComplete && !progress.isOpenEnded && (
              <Badge variant="success" size="sm">
                Complete
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-400">{progress.summaryAmount}</p>
          {!progress.isOpenEnded && (
            <div className="mt-2 h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
          )}
        </div>
        <div className="text-gray-400 shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
          {detailLoading || !detail ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading details…
            </div>
          ) : (
            <GoalDetailPanel detail={detail} onDelete={onDelete} />
          )}
        </div>
      )}
    </Card>
  );
}

function GoalDetailPanel({
  detail,
  onDelete,
}: {
  detail: GoalDetail;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-5">
      <TypeStats detail={detail} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HistorySection detail={detail} />
        <ProjectedSection detail={detail} />
      </div>

      {detail.chart && <GoalChart detail={detail} />}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" /> Delete goal
        </button>
      </div>
    </div>
  );
}

function TypeStats({ detail }: { detail: GoalDetail }) {
  const stats = detail.stats as Record<string, any>;

  if (detail.type === 'loan') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Outstanding" value={formatCurrency(stats.outstandingBalance ?? 0)} />
        <Stat label="EMI" value={formatCurrency(stats.emi ?? 0)} />
        <Stat label="Interest paid" value={formatCurrency(stats.interestPaidToDate ?? 0)} />
        <Stat label="Interest left" value={formatCurrency(stats.interestRemaining ?? 0)} />
      </div>
    );
  }

  if (detail.type === 'sip') {
    const sip = stats.sip as Record<string, any> | undefined;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Invested" value={formatCurrency(stats.invested ?? 0)} />
        <Stat label="Current value" value={formatCurrency(sip?.currentValue ?? 0)} />
        <Stat label="Assumed return" value={`${stats.annualRate ?? 0}% p.a.`} />
        {stats.isOpenEnded ? (
          <Stat label="Tenure" value="Ongoing" />
        ) : (
          <Stat
            label="Projected final"
            value={formatCurrency(sip?.projectedFinalValue ?? 0)}
          />
        )}
      </div>
    );
  }

  const projection = stats.projection as
    | { projectionAvailable: boolean; monthsNeeded?: number; projectedCompletionDate?: string; remaining?: number }
    | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Remaining" value={formatCurrency(stats.remaining ?? 0)} />
        <Stat
          label="Target date"
          value={stats.targetDate ? formatDate(stats.targetDate) : 'Not set'}
        />
        <Stat
          label="Monthly pace"
          value={
            stats.typicalMonthlyAmount
              ? formatCurrency(stats.typicalMonthlyAmount)
              : 'Not set'
          }
        />
      </div>
      {projection && !projection.projectionAvailable && (stats.remaining ?? 0) > 0 && (
        <p className="text-sm text-amber-400/90">
          Set a typical monthly contribution to project when you’ll reach the target.
        </p>
      )}
      {projection?.projectionAvailable && (stats.remaining ?? 0) > 0 && (
        <p className="text-sm text-gray-300">
          At this pace, about {projection.monthsNeeded} month
          {projection.monthsNeeded === 1 ? '' : 's'} — estimated{' '}
          {projection.projectedCompletionDate
            ? formatDate(projection.projectedCompletionDate)
            : '—'}
          .
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-sm font-medium text-white mt-0.5">{value}</div>
    </div>
  );
}

function HistorySection({ detail }: { detail: GoalDetail }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-2">History</h4>
      <p className="text-xs text-gray-500 mb-2">Completed, already-matched transactions</p>
      {detail.historyEmpty || detail.history.length === 0 ? (
        <p className="text-sm text-gray-400 bg-gray-800/40 rounded-lg px-3 py-4">
          No matching transactions yet. Tag transactions with {detail.tag} to track progress.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto">
          {detail.history.map((tx) => (
            <li
              key={tx._id}
              className="flex items-center justify-between gap-2 text-sm bg-gray-800/40 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-gray-300 truncate">{tx.description}</div>
                <div className="text-xs text-gray-500">{formatDate(tx.date)}</div>
              </div>
              <div className="font-medium text-white shrink-0">
                {formatCurrency(Math.abs(tx.amount))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectedSection({ detail }: { detail: GoalDetail }) {
  const { items, moreCount, untilDate } = detail.projected;
  const showPaceHint =
    detail.type === 'goal' &&
    !(detail.stats as any).typicalMonthlyAmount &&
    !detail.progress.isComplete;

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-2">Projected</h4>
      <p className="text-xs text-gray-500 mb-2">Estimates — not yet completed</p>
      {showPaceHint ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-600 rounded-lg px-3 py-4">
          A typical monthly contribution is needed to project the remainder.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-600 rounded-lg px-3 py-4">
          {detail.progress.isComplete
            ? 'Fully paid / matured — nothing left to project.'
            : 'No upcoming installments to show.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((row, idx) => (
            <li
              key={`${row.date}-${idx}`}
              className="flex items-center justify-between gap-2 text-sm border border-dashed border-gray-600/80 bg-gray-800/20 rounded-lg px-3 py-2 text-gray-400"
            >
              <div className="min-w-0">
                <div className="truncate">
                  {row.label || 'Installment'}{' '}
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">
                    estimate
                  </span>
                </div>
                <div className="text-xs text-gray-500">{formatDate(row.date)}</div>
              </div>
              <div className="font-medium shrink-0">{formatCurrency(row.amount)}</div>
            </li>
          ))}
          {moreCount > 0 && (
            <li className="text-xs text-gray-500 px-1 pt-1">
              +{moreCount} more until payoff ≈{' '}
              {untilDate ? formatDate(untilDate) : '—'}
            </li>
          )}
          {detail.type === 'sip' && detail.progress.isOpenEnded && (
            <li className="text-xs text-gray-500 px-1 pt-1">
              Ongoing SIP — installments continue indefinitely.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function GoalChart({ detail }: { detail: GoalDetail }) {
  if (!detail.chart) return null;

  if (detail.chart.type === 'sip_horizons' && detail.chart.horizons) {
    const focus = detail.chart.horizons.filter((h) => [5, 10, 20].includes(h.years));
    return (
      <div>
        <h4 className="text-sm font-semibold text-white mb-2">Horizon projections</h4>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {focus.map((h) => (
            <div key={h.years} className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
              <div className="text-xs text-gray-500">{h.years}-year</div>
              <div className="text-sm font-medium text-white">{formatCurrency(h.value)}</div>
            </div>
          ))}
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={detail.chart.horizons}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="years"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(y) => `${y}y`}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(v) => formatCompactNumber(v)}
              />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151' }}
                formatter={(value: number) => [formatCurrency(value), 'Value']}
                labelFormatter={(y) => `${y} years`}
              />
              <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  const series = detail.chart.series ?? [];
  const dataKey = detail.chart.type === 'loan_outstanding' ? 'outstanding' : 'value';
  const title =
    detail.chart.type === 'loan_outstanding'
      ? 'Projected outstanding balance'
      : 'Projected SIP value';

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickFormatter={(m) => (m % 12 === 0 ? `${m / 12}y` : '')}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickFormatter={(v) => formatCompactNumber(v)}
            />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151' }}
              formatter={(value: number) => [formatCurrency(value), dataKey]}
              labelFormatter={(m) => `Month ${m}`}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AddGoalModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<GoalType>('goal');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [tagTouched, setTagTouched] = useState(false);
  const [form, setForm] = useState({
    targetAmount: '',
    targetDate: '',
    typicalMonthlyAmount: '',
    principal: '',
    annualRate: '',
    tenureMonths: '',
    startDate: '',
    monthlyAmount: '',
  });

  const reset = () => {
    setType('goal');
    setName('');
    setTag('');
    setTagTouched(false);
    setForm({
      targetAmount: '',
      targetDate: '',
      typicalMonthlyAmount: '',
      principal: '',
      annualRate: '',
      tenureMonths: '',
      startDate: '',
      monthlyAmount: '',
    });
  };

  useEffect(() => {
    if (!tagTouched && name) {
      setTag(suggestTagFromName(name));
    }
  }, [name, tagTouched]);

  const preview = useMemo(() => {
    if (type === 'loan') {
      const P = parseFloat(form.principal);
      const rate = parseFloat(form.annualRate);
      const n = parseInt(form.tenureMonths, 10);
      if (!P || !n || Number.isNaN(rate)) return null;
      const emi = calculateEmi(P, rate || 0, n);
      return {
        lines: [
          `EMI: ${formatCurrency(emi)}`,
          `Total payable: ${formatCurrency(emi * n)}`,
        ],
      };
    }
    if (type === 'sip') {
      const M = parseFloat(form.monthlyAmount);
      const rate = parseFloat(form.annualRate);
      const nRaw = form.tenureMonths.trim();
      if (!M || Number.isNaN(rate)) return null;
      if (!nRaw) {
        const horizons = [5, 10, 20].map((years) => ({
          years,
          value: sipFvAtMonths(M, rate || 0, years * 12),
        }));
        return {
          lines: [
            'Ongoing SIP (no end date)',
            ...horizons.map((h) => `${h.years}y ≈ ${formatCurrency(h.value)}`),
          ],
        };
      }
      const n = parseInt(nRaw, 10);
      if (!n) return null;
      return {
        lines: [`Projected value: ${formatCurrency(sipFvAtMonths(M, rate || 0, n))}`],
      };
    }
    return null;
  }, [type, form]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateGoalPayload) => goalService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      reset();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let details: Record<string, unknown>;
    if (type === 'goal') {
      details = {
        targetAmount: parseFloat(form.targetAmount),
        targetDate: form.targetDate || null,
        typicalMonthlyAmount: form.typicalMonthlyAmount
          ? parseFloat(form.typicalMonthlyAmount)
          : null,
      };
    } else if (type === 'loan') {
      details = {
        principal: parseFloat(form.principal),
        annualRate: parseFloat(form.annualRate),
        tenureMonths: parseInt(form.tenureMonths, 10),
        startDate: form.startDate,
      };
    } else {
      details = {
        monthlyAmount: parseFloat(form.monthlyAmount),
        annualRate: parseFloat(form.annualRate),
        tenureMonths: form.tenureMonths.trim()
          ? parseInt(form.tenureMonths, 10)
          : null,
        startDate: form.startDate,
      };
    }

    createMutation.mutate({
      name: name.trim(),
      type,
      tag: normalizeTag(tag),
      details,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Goal" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as GoalType)}
          options={[
            { value: 'goal', label: 'Goal' },
            { value: 'loan', label: 'Loan' },
            { value: 'sip', label: 'SIP' },
          ]}
        />

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Home Loan"
          required
        />

        <Input
          label="Tag"
          value={tag}
          onChange={(e) => {
            setTagTouched(true);
            setTag(e.target.value);
          }}
          placeholder="#home-loan"
          required
        />

        {type === 'goal' && (
          <>
            <Input
              label="Target amount"
              type="number"
              min="1"
              step="0.01"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
              required
            />
            <Input
              label="Target date (optional)"
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
            <Input
              label="Typical monthly contribution (optional)"
              type="number"
              min="0"
              step="0.01"
              value={form.typicalMonthlyAmount}
              onChange={(e) =>
                setForm({ ...form, typicalMonthlyAmount: e.target.value })
              }
              placeholder="Used only for projections"
            />
          </>
        )}

        {type === 'loan' && (
          <>
            <Input
              label="Principal"
              type="number"
              min="1"
              step="0.01"
              value={form.principal}
              onChange={(e) => setForm({ ...form, principal: e.target.value })}
              required
            />
            <Input
              label="Annual interest rate (%)"
              type="number"
              min="0"
              step="0.01"
              value={form.annualRate}
              onChange={(e) => setForm({ ...form, annualRate: e.target.value })}
              required
            />
            <Input
              label="Tenure (months)"
              type="number"
              min="1"
              step="1"
              value={form.tenureMonths}
              onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
              required
            />
            <Input
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </>
        )}

        {type === 'sip' && (
          <>
            <Input
              label="Monthly amount"
              type="number"
              min="1"
              step="0.01"
              value={form.monthlyAmount}
              onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
              required
            />
            <Input
              label="Assumed annual return (%)"
              type="number"
              min="0"
              step="0.01"
              value={form.annualRate}
              onChange={(e) => setForm({ ...form, annualRate: e.target.value })}
              required
            />
            <Input
              label="Duration (months)"
              type="number"
              min="1"
              step="1"
              value={form.tenureMonths}
              onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })}
              placeholder="Leave blank for an ongoing SIP"
            />
            <p className="text-xs text-gray-500 -mt-2">
              Leave blank for an ongoing SIP with no fixed end date.
            </p>
            <Input
              label="Start date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </>
        )}

        {preview && (
          <div className="rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-2 space-y-1">
            <div className="text-xs uppercase tracking-wide text-primary-300">Live preview</div>
            {preview.lines.map((line) => (
              <div key={line} className="text-sm text-gray-200">
                {line}
              </div>
            ))}
          </div>
        )}

        {createMutation.isError && (
          <p className="text-sm text-red-400">
            {(createMutation.error as any)?.response?.data?.error?.message ||
              'Failed to create goal'}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
