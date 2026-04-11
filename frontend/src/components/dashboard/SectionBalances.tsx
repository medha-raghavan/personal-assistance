import React from 'react';
import { CreditCard, Wallet, PiggyBank, Building2, Landmark, Smartphone } from 'lucide-react';
import { Card, CardHeader } from '../common';
import { formatCurrency } from '../../utils/formatters';

interface SectionBalance {
  id: string;
  name: string;
  label: string;
  type: string;
  balance: number;
}

interface SectionBalancesProps {
  sections: SectionBalance[];
}

export function SectionBalances({ sections }: SectionBalancesProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <CreditCard className="w-5 h-5" />;
      case 'cash':
        return <Wallet className="w-5 h-5" />;
      case 'savings':
        return <PiggyBank className="w-5 h-5" />;
      case 'investment':
        return <Landmark className="w-5 h-5" />;
      case 'digital_wallet':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <Building2 className="w-5 h-5" />;
    }
  };
  
  const getBalanceColor = (type: string, balance: number) => {
    if (type === 'credit') {
      return balance > 0 ? 'text-red-400' : 'text-green-400';
    }
    return balance >= 0 ? 'text-green-400' : 'text-red-400';
  };
  
  return (
    <Card>
      <CardHeader title="Section Balances" />
      
      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.id}
            className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-700 rounded-lg text-gray-300">
                {getIcon(section.type)}
              </div>
              <div>
                <p className="font-medium text-white">{section.label || section.name}</p>
                <p className="text-xs text-gray-400 capitalize">{section.type.replace('_', ' ')}</p>
              </div>
            </div>
            <p className={`font-semibold ${getBalanceColor(section.type, section.balance)}`}>
              {section.type === 'credit' && section.balance > 0 && '-'}
              {formatCurrency(Math.abs(section.balance))}
            </p>
          </div>
        ))}
        
        {sections.length === 0 && (
          <p className="text-center text-gray-400 py-4">No sections yet</p>
        )}
      </div>
    </Card>
  );
}
