import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardSummaryFilters } from '../types';
import './Dashboard.css';

type Period = DashboardSummaryFilters['period'];
type TxType = NonNullable<DashboardSummaryFilters['type']>;

const PERIOD_SHORT: Record<Exclude<Period, 'custom'>, string> = {
  '7': '7d',
  '30': '30d',
  '90': '90d',
  '365': '1y',
  all: 'all time',
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function inr(n: number): string {
  return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}

function inrShort(n: number): string {
  if (n >= 1000) return '₹' + Math.round(n / 1000) + 'k';
  return inr(n);
}

function catGlyph(icon?: string, name?: string): string {
  if (icon && !/^[a-z0-9-]+$/i.test(icon)) return icon;
  return (name || '?').charAt(0).toUpperCase();
}

function fmtTxDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function Dashboard() {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('30');
  const [sectionId, setSectionId] = useState('');
  const [type, setType] = useState<TxType>('all');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filters: DashboardSummaryFilters = useMemo(
    () => ({
      period,
      sectionId: sectionId || undefined,
      type,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      startDate: period === 'custom' ? startDate : undefined,
      endDate: period === 'custom' ? endDate : undefined,
    }),
    [period, sectionId, type, categoryIds, startDate, endDate]
  );

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-summary', filters],
    queryFn: () => dashboardService.getSummary(filters),
    placeholderData: keepPreviousData,
  });

  const selectedAccountName = data?.accounts.find((a) => a.id === sectionId)?.name;
  const selectedCatNames = data?.categories.filter((c) => categoryIds.includes(c.id)) ?? [];
  const catButtonLabel =
    categoryIds.length === 0
      ? 'All categories'
      : categoryIds.length === 1
        ? (selectedCatNames[0]?.name || '1 category')
        : `${categoryIds.length} categories selected`;

  const periodPill =
    period === 'custom'
      ? data?.meta.periodLabel || 'custom'
      : PERIOD_SHORT[period];

  function handlePeriodChange(next: Period) {
    setPeriod(next);
    if (next === 'custom') {
      setStartDate((prev) => prev || daysAgoIso(30));
      setEndDate((prev) => prev || isoDate(new Date()));
    }
  }

  function handleTypeChange(next: TxType) {
    setType(next);
    setCategoryIds([]);
  }

  function resetFilters() {
    setSectionId('');
    setPeriod('30');
    setType('all');
    setCategoryIds([]);
    setStartDate('');
    setEndDate('');
    setCatOpen(false);
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (isPending && !data) {
    return (
      <div className="ledger-dash">
        <div className="ld-loading">Loading dashboard…</div>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="ledger-dash">
        <div className="ld-error">
          Couldn’t load the dashboard.
          <br />
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const dowMax = Math.max(1, ...data.dayOfWeek.days.map((d) => d.amount));
  const trendMax = Math.max(1, ...data.monthlyTrend.flatMap((m) => [m.income, m.expense]));
  const hasDow = data.dayOfWeek.days.some((d) => d.count > 0);
  const insight = data.dayOfWeek.insight;

  return (
    <div className="ledger-dash" style={{ opacity: isFetching ? 0.85 : 1 }}>
      <div className="ld-top">
        <div>
          <h1>Financial dashboard</h1>
          <div className="ld-sub">{data.meta.subtitle}</div>
        </div>
        <button type="button" className="ld-add" onClick={() => navigate('/transactions')}>
          Add transaction
        </button>
      </div>

      <div className={`filterbar${filtersOpen ? ' open' : ''}`}>
        <div className="filter-head" onClick={() => setFiltersOpen((v) => !v)}>
          <div className="filter-head-left">
            <span className="filter-title">Filters</span>
            {!filtersOpen && (
              <div className="filter-summary">
                <span className="fs-pill">{selectedAccountName || 'All accounts'}</span>
                <span className="fs-pill">{periodPill}</span>
                {type !== 'all' && (
                  <span className="fs-pill">{type === 'credit' ? 'Income' : 'Expense'}</span>
                )}
                {categoryIds.length > 0 && (
                  <span className="fs-pill">{categoryIds.length} categories</span>
                )}
              </div>
            )}
          </div>
          <span className="chevron">▾</span>
        </div>
        <div className="filter-body">
          <div className="filter-body-inner" onClick={(e) => e.stopPropagation()}>
            <div className="fgroup">
              <label>Account</label>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">All accounts</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="fgroup">
              <label>Period</label>
              <select value={period} onChange={(e) => handlePeriodChange(e.target.value as Period)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">This year</option>
                <option value="all">All time</option>
                <option value="custom">Custom range…</option>
              </select>
            </div>
            <div className={`date-range${period === 'custom' ? ' show' : ''}`}>
              <div className="fgroup">
                <label>From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <span className="date-sep">→</span>
              <div className="fgroup">
                <label>To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="fgroup">
              <label>Type</label>
              <div className="seg">
                {([
                  ['all', 'All'],
                  ['credit', 'Income'],
                  ['debit', 'Expense'],
                ] as const).map(([value, label]) => (
                  <span
                    key={value}
                    className={type === value ? 'active' : ''}
                    onClick={() => handleTypeChange(value)}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="fgroup">
              <label>Categories</label>
              <div className="msel" ref={catRef}>
                <div
                  className="msel-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCatOpen((v) => !v);
                  }}
                >
                  <span>{catButtonLabel}</span>
                  <span className="arrow">▾</span>
                </div>
                <div className={`msel-panel${catOpen ? ' open' : ''}`}>
                  <div className="msel-clear" onClick={() => setCategoryIds([])}>
                    Clear selection
                  </div>
                  {data.categories.map((c) => {
                    const checked = categoryIds.includes(c.id);
                    return (
                      <label key={c.id} className={`msel-opt${checked ? ' checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(c.id)}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <button type="button" className="reset-btn" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </div>
      </div>

      <div className="hero">
        <div className="hero-card balance">
          <div className="hero-label">Balance</div>
          <div className="hero-value">{inr(data.hero.totalBalance)}</div>
          <div className="accounts-row">
            {data.accounts.map((a) => (
              <span
                key={a.id}
                className="acc-chip"
                style={{ opacity: sectionId && sectionId !== a.id ? 0.4 : 1 }}
              >
                {a.name} <b>{inr(a.balance)}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="hero-card">
          <div className="hero-label">Income</div>
          <div className="hero-value income">{inr(data.hero.income)}</div>
          <div className="hero-foot">{data.hero.incomeCount} transactions</div>
        </div>
        <div className="hero-card">
          <div className="hero-label">Expenses</div>
          <div className="hero-value expense">{inr(data.hero.expense)}</div>
          <div className="hero-foot">{data.hero.expenseCount} transactions</div>
        </div>
        <div className="hero-card">
          <div className="hero-label">Net savings</div>
          <div className="hero-value savings">
            {data.hero.net < 0 ? '-' : '+'}{inr(data.hero.net)}
          </div>
          <div className="hero-foot">
            {data.hero.income > 0 ? `${Math.round(data.hero.savingsRate)}% savings rate` : '—'}
          </div>
        </div>
      </div>

      <div className="ld-grid">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Spending by day of week</div>
            <div className="card-note">{data.meta.periodLabel}</div>
          </div>
          <div className="dow-wrap">
            {!hasDow ? (
              <div className="empty-note" style={{ width: '100%' }}>
                No expenses match these filters
              </div>
            ) : (
              data.dayOfWeek.days.map((d) => (
                <div key={d.label} className="dow-col">
                  <div className="dow-amt">{d.amount >= 1000 ? inrShort(d.amount) : inr(d.amount)}</div>
                  <div
                    className={`dow-bar${d.isWeekend ? ' weekend' : ''}`}
                    style={{ height: `${Math.max(3, (d.amount / dowMax) * 100)}px` }}
                    title={`${d.label}: ${inr(d.amount)} across ${d.count} transactions`}
                  />
                  <div className="dow-label">{d.label}</div>
                </div>
              ))
            )}
          </div>
          {insight && (
            <div className="dow-insight">
              Most spending falls on <b>{insight.peakDay}</b> ({inr(insight.peakAmount)}), least on{' '}
              <b>{insight.troughDay}</b>.{' '}
              {insight.weekendsHigher ? (
                <>Weekends run <b>{insight.skewPercent}% higher</b> per day than weekdays.</>
              ) : (
                <>Weekdays run <b>{insight.skewPercent}% higher</b> per day than weekends.</>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">
              {data.categoryBreakdown.mode === 'income' ? 'Income by source' : 'Spending by category'}
            </div>
            <div className="card-note">{inr(data.categoryBreakdown.total)} total</div>
          </div>
          <div className="cat-list">
            {data.categoryBreakdown.items.length === 0 ? (
              <div className="empty-note">No transactions match these filters</div>
            ) : (
              data.categoryBreakdown.items.map((item, idx) => (
                <div key={item.id || `${item.name}-${idx}`} className="cat-row">
                  <div
                    className="cat-icon"
                    style={{ background: `${item.color}22`, color: item.color }}
                  >
                    {catGlyph(item.icon, item.name)}
                  </div>
                  <div className="cat-info">
                    <div className="cat-top">
                      <span className="name">{item.name}</span>
                      <span className="amt">{inr(item.amount)} · {item.percentage}%</span>
                    </div>
                    <div className="cat-track">
                      <div
                        className="cat-fill"
                        style={{ width: `${item.percentage}%`, background: item.color }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-head">
          <div className="card-title">Monthly trend</div>
          <div className="card-note">last 6 months · selected account</div>
        </div>
        <div className="trend-wrap">
          {data.monthlyTrend.map((m) => (
            <div key={m.period} className="trend-col">
              <div className="trend-bars">
                <div
                  className="trend-bar in"
                  style={{ height: `${Math.max(2, (m.income / trendMax) * 120)}px` }}
                  title={`Income ${inr(m.income)}`}
                />
                <div
                  className="trend-bar out"
                  style={{ height: `${Math.max(2, (m.expense / trendMax) * 120)}px` }}
                  title={`Expense ${inr(m.expense)}`}
                />
              </div>
              <div className="trend-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-head" style={{ marginBottom: 10 }}>
        <div className="card-title" style={{ fontSize: 14 }}>Spending by account</div>
        <div className="card-note">reflects period, type and category filters above</div>
      </div>
      <div className="acc-breakdown">
        {data.accountBreakdown.length === 0 ? (
          <div className="empty-note">No accounts yet</div>
        ) : (
          data.accountBreakdown.map((acc) => (
            <div key={acc.id} className={`acc-card${acc.dimmed ? ' dimmed' : ''}`}>
              <div className="acc-card-head">
                <div className="acc-card-name">{acc.name}</div>
                <div className="acc-card-bal">{inr(acc.balance)}</div>
              </div>
              <div className="acc-stat-row">
                <div className="acc-stat">
                  <div className="l">Income</div>
                  <div className="v in">{inr(acc.income)}</div>
                </div>
                <div className="acc-stat">
                  <div className="l">Expense</div>
                  <div className="v out">{inr(acc.expense)}</div>
                </div>
              </div>
              {acc.topCategories.length === 0 ? (
                <div className="empty-note" style={{ padding: '10px 0' }}>No spending in range</div>
              ) : (
                acc.topCategories.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="acc-mini-cat">
                    <span>{c.name}</span>
                    <span>{inr(c.amount)}</span>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title">Top transactions</div>
          <div className="card-note">top {data.topTransactions.length} by amount</div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Account</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.topTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-note">No transactions match these filters</div>
                  </td>
                </tr>
              ) : (
                data.topTransactions.map((t, i) => {
                  const isIn = t.type === 'credit';
                  return (
                    <tr key={t.id}>
                      <td className="tx-rank">{i + 1}</td>
                      <td className="tx-date">{fmtTxDate(t.date)}</td>
                      <td className="tx-desc">
                        {t.description}
                        {t.tags[0] && <span className="tx-tag">#{t.tags[0]}</span>}
                      </td>
                      <td><span className="tx-cat">{t.categoryName}</span></td>
                      <td className="tx-acc">{t.accountName}</td>
                      <td className={`tx-amt ${isIn ? 'in' : 'out'}`}>
                        {isIn ? '+' : '-'}{inr(t.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
