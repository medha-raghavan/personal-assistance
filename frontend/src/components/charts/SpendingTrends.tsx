import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader } from '../common';
import { TrendData } from '../../types';
import { formatCompactNumber } from '../../utils/formatters';

interface SpendingTrendsProps {
  data: TrendData[];
}

export function SpendingTrends({ data }: SpendingTrendsProps) {
  const formattedData = data.map((d) => ({
    ...d,
    month: d.period.split('-')[1] ? 
      new Date(d.period + '-01').toLocaleDateString('en-IN', { month: 'short' }) :
      d.period,
  }));
  
  return (
    <Card>
      <CardHeader title="Spending Trends" subtitle="Last 6 months" />
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
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
              formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
              labelStyle={{ fontWeight: 600, color: '#111' }}
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            <Line
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4, fill: '#22c55e' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Expense"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 4, fill: '#ef4444' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
