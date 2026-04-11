import React from 'react';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Card, CardHeader, Badge } from '../common';
import { Transaction, Section } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface RecentTransactionsProps {
  transactions: Transaction[];
  onViewAll: () => void;
}

export function RecentTransactions({ transactions, onViewAll }: RecentTransactionsProps) {
  return (
    <Card>
      <CardHeader
        title="Recent Transactions"
        action={
          <button
            onClick={onViewAll}
            className="text-sm text-primary-400 hover:text-primary-300 font-medium"
          >
            View All
          </button>
        }
      />
      
      <div className="space-y-2">
        {transactions.map((transaction) => {
          const section = transaction.sectionId as Section;
          
          return (
            <div
              key={transaction._id}
              className="flex items-center justify-between p-3 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    transaction.type === 'credit'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}
                >
                  {transaction.type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                
                <div className="min-w-0">
                  <p className="font-medium text-white truncate max-w-[200px]">
                    {transaction.description.split('-')[1]?.split('@')[0] || transaction.description.slice(0, 30)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {formatDate(transaction.transactionDate, 'short')}
                    </span>
                    {section?.name && (
                      <Badge size="sm">{section.name}</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <p
                className={`font-semibold ${
                  transaction.type === 'credit' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {transaction.type === 'credit' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          );
        })}
        
        {transactions.length === 0 && (
          <p className="text-center text-gray-400 py-8">No transactions yet</p>
        )}
      </div>
    </Card>
  );
}
