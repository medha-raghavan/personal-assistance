import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardHeader } from '../common';
import { TrendData } from '../../types';
import { formatCompactNumber } from '../../utils/formatters';

interface MonthlyBarChartProps {
  data: TrendData[];
}

export function MonthlyBarChart({ data }: MonthlyBarChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    month: d.period.split('-')[1]
      ? new Date(d.period + '-01').toLocaleDateString('en-IN', { month: 'short' })
      : d.period,
    net: d.income - d.expense,
  }));

  return (
    <Card>
      <CardHeader title="Monthly Comparison" subtitle="Income vs Expense" />

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} barGap={0} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              tickFormatter={(value) => formatCompactNumber(value)}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `₹${value.toLocaleString()}`,
                name === 'income' ? 'Income' : 'Expense',
              ]}
              labelStyle={{ fontWeight: 600, color: '#111' }}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend
              wrapperStyle={{ color: '#9ca3af' }}
              formatter={(value) => (value === 'income' ? 'Income' : 'Expense')}
            />
            <Bar dataKey="income" name="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface SavingsBarChartProps {
  data: TrendData[];
}

export function SavingsBarChart({ data }: SavingsBarChartProps) {
  const formattedData = data.map((d) => ({
    ...d,
    month: d.period.split('-')[1]
      ? new Date(d.period + '-01').toLocaleDateString('en-IN', { month: 'short' })
      : d.period,
    savings: d.income - d.expense,
  }));

  return (
    <Card>
      <CardHeader title="Monthly Savings" subtitle="Net income after expenses" />

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              tickFormatter={(value) => formatCompactNumber(value)}
            />
            <Tooltip
              formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Savings']}
              labelStyle={{ fontWeight: 600, color: '#111' }}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Bar dataKey="savings" name="Savings" radius={[4, 4, 0, 0]}>
              {formattedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.savings >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
