import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/formatters';

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  change?: number;
  isCurrency?: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'danger';
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  isCurrency = true,
  icon,
  variant = 'default',
}: StatCardProps) {
  const variantStyles = {
    default: 'text-white',
    success: 'text-green-400',
    danger: 'text-red-400',
  };
  
  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {icon && (
          <div className="p-2 bg-gray-700 rounded-lg">
            {icon}
          </div>
        )}
      </div>
      
      <p className={`mt-2 text-2xl font-bold ${variantStyles[variant]}`}>
        {isCurrency ? formatCurrency(value) : `${value.toLocaleString()}%`}
      </p>
      
      {(subtitle || change !== undefined) && (
        <div className="mt-2 flex items-center gap-2">
          {change !== undefined && (
            <span className={`flex items-center text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              {formatPercent(change)}
            </span>
          )}
          {subtitle && (
            <span className="text-sm text-gray-400">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
