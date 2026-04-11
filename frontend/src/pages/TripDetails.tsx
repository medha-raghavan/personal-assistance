import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Users, ArrowLeft, Trash2, ArrowRight, UserPlus, Receipt,
  ChevronDown, ChevronUp, Link, Download, Edit2, CheckCircle, XCircle, Play,
} from 'lucide-react';
import { Card, Button, Input, Modal, Badge, Select } from '../components/common';
import { tripService, TripExpense } from '../services/trip.service';
import { formatCurrency } from '../utils/formatters';
import { Trip, TripMember, Transaction } from '../types';
import { useAuthStore } from '../store/authStore';

function formatDateWithYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TripDetails() {
  const { id: tripId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'expenses' | 'breakdown' | 'members' | 'balances'>('expenses');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TripExpense | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [newMemberNames, setNewMemberNames] = useState('');
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => tripService.getById(tripId!),
    enabled: !!tripId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: () => tripService.getExpenses(tripId!),
    enabled: !!tripId,
  });

  const { data: linkedTransactions = [] } = useQuery({
    queryKey: ['trip-linked-transactions', tripId],
    queryFn: () => tripService.getLinkedTransactions(tripId!),
    enabled: !!tripId,
  });

  const { data: balances } = useQuery({
    queryKey: ['trip-balances', tripId],
    queryFn: () => tripService.getBalances(tripId!),
    enabled: !!tripId,
  });

  const addMemberMutation = useMutation({
    mutationFn: (member: { name: string; email?: string }) =>
      tripService.addMember(tripId!, { ...member, isRegisteredUser: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const handleAddMultipleMembers = async () => {
    const names = newMemberNames
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (names.length === 0) return;

    setIsAddingMembers(true);
    try {
      for (const name of names) {
        await tripService.addMember(tripId!, { name, isRegisteredUser: false });
      }
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowAddMember(false);
      setNewMemberNames('');
    } catch (error) {
      console.error('Failed to add members:', error);
    } finally {
      setIsAddingMembers(false);
    }
  };

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => tripService.removeMember(tripId!, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => tripService.deleteExpense(tripId!, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ expenseId, data }: { expenseId: string; data: any }) =>
      tripService.updateExpense(tripId!, expenseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      setShowEditExpense(false);
      setEditingExpense(null);
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: (data: Partial<Trip>) => tripService.update(tripId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      setShowStatusMenu(false);
    },
  });

  if (tripLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Trip not found</p>
        <Button variant="secondary" onClick={() => navigate('/trips')} className="mt-4">
          Back to Trips
        </Button>
      </div>
    );
  }

  const isCurrentUser = (member: TripMember): boolean => {
    if (!user) return false;
    const userName = user.name.toLowerCase();
    const userEmail = user.email.toLowerCase();
    const memberName = member.name.toLowerCase();
    const memberEmail = member.email?.toLowerCase() || '';
    return memberName === userName || memberName === 'medha' || memberEmail === userEmail;
  };

  const getMemberDisplayName = (member: TripMember): string => {
    return isCurrentUser(member) ? `${member.name} (Me)` : member.name;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const linkedWithSplits = linkedTransactions.filter(t => t.tripSplits && t.tripSplits.length > 0);
  const linkedTotal = linkedWithSplits.reduce((sum, t) => sum + t.amount, 0);
  const grandTotal = totalExpenses + linkedTotal;

  type CombinedItem =
    | { type: 'expense'; data: TripExpense; date: Date }
    | { type: 'linked'; data: Transaction; date: Date };

  const allItems: CombinedItem[] = [
    ...expenses.map(e => ({ type: 'expense' as const, data: e, date: new Date(e.date) })),
    ...linkedTransactions.map(t => ({ type: 'linked' as const, data: t, date: new Date(t.transactionDate) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const exportToExcel = () => {
    const memberNames = trip.members.map(m => m.name);
    const headers = ['Date', 'Description', 'Category', 'Cost', 'Currency', ...memberNames];
    const rows: string[][] = [];

    // Format date as YYYY-MM-DD
    const formatDateForExport = (dateStr: string): string => {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };

    // Track totals for each member
    const memberTotals: Record<string, number> = {};
    trip.members.forEach(m => { memberTotals[m._id!] = 0; });

    // Sort all items by date ascending for export
    const sortedItems = [...allItems].sort((a, b) => a.date.getTime() - b.date.getTime());

    sortedItems.forEach(item => {
      const isExp = item.type === 'expense';
      const amount = item.data.amount;
      const splits = isExp
        ? (item.data as TripExpense).splits
        : (item.data as Transaction).tripSplits;
      const paidById = isExp
        ? (item.data as TripExpense).paidByMemberId
        : (item.data as Transaction).paidByMemberId;

      const getMemberSplit = (memberId: string): number => {
        if (!splits) return 0;
        const split = splits.find((s: { memberId: string; amount: number }) => s.memberId === memberId);
        return split ? split.amount : 0;
      };

      const memberValues = trip.members.map(member => {
        const memberShare = getMemberSplit(member._id!);
        const isPayer = member._id === paidById;
        const netAmount = isPayer ? amount - memberShare : -memberShare;
        memberTotals[member._id!] += netAmount;
        return netAmount.toFixed(2);
      });

      rows.push([
        formatDateForExport(isExp ? (item.data as TripExpense).date : (item.data as Transaction).transactionDate),
        item.data.description,
        isExp ? ((item.data as TripExpense).category || '') : 'Linked',
        amount.toFixed(2),
        isExp ? (item.data as TripExpense).currency : (trip.defaultCurrency || 'INR'),
        ...memberValues,
      ]);
    });

    // Add empty row before total
    rows.push([]);

    // Add total balance row with today's date
    const today = new Date().toISOString().split('T')[0];
    const totalRow = [
      today,
      'Total balance',
      '',
      '',
      trip.defaultCurrency,
      ...trip.members.map(m => memberTotals[m._id!].toFixed(2)),
    ];
    rows.push(totalRow);

    // Add empty row at end
    rows.push([]);

    const csvContent = [headers.join(','), '', ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${trip.name.replace(/\s+/g, '_')}_breakdown.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/trips')}
          >
            Back
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={exportToExcel}
          >
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{trip.name}</h1>
            <button
              onClick={() => setShowStatusMenu(true)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                (trip.status || 'active') === 'completed'
                  ? 'bg-primary-900/50 text-primary-400 hover:bg-primary-900/70'
                  : (trip.status || 'active') === 'cancelled'
                  ? 'bg-red-900/50 text-red-400 hover:bg-red-900/70'
                  : 'bg-green-900/50 text-green-400 hover:bg-green-900/70'
              }`}
            >
              {(trip.status || 'active') === 'completed' ? 'Completed' : (trip.status || 'active') === 'cancelled' ? 'Cancelled' : 'Active'}
            </button>
          </div>
          <p className="text-sm sm:text-base text-gray-400">
            {trip.description || `${trip.members.length} members · ${trip.defaultCurrency}`}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Total</p>
          <p className="text-sm sm:text-2xl font-bold text-white">{formatCurrency(grandTotal)}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">
            {expenses.length} expenses + {linkedTransactions.length} linked
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Members</p>
          <p className="text-sm sm:text-2xl font-bold text-white">{trip.members.length}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">
            {trip.startDate ? formatDateWithYear(trip.startDate) : 'No dates'}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Per Person</p>
          <p className="text-sm sm:text-2xl font-bold text-white">
            {trip.members.length > 0 ? formatCurrency(grandTotal / trip.members.length) : '-'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 hidden sm:block">Average</p>
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 sm:gap-2 border-b border-gray-700 pb-2 min-w-max">
          {(['expenses', 'breakdown', 'members', 'balances'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'expenses' && ` (${allItems.length})`}
              {tab === 'members' && ` (${trip.members.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <Card>
          <div className="p-3 sm:p-4 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">All Expenses</h2>
              <p className="text-xs sm:text-sm text-gray-400">
                {expenses.length} expenses + {linkedTransactions.length} linked
              </p>
            </div>
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddExpense(true)}
              disabled={trip.members.length === 0}
              size="sm"
              className="self-start sm:self-auto"
            >
              Add Expense
            </Button>
          </div>

          {trip.members.length === 0 && (
            <div className="p-3 sm:p-4 bg-yellow-900/30 border-b border-yellow-700 text-yellow-400 text-xs sm:text-sm">
              Add members to the trip before adding expenses.
            </div>
          )}

          {/* Desktop Table View */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 border-b border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Paid By</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {allItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No expenses yet. Add expenses or link transactions from the Transactions page.
                    </td>
                  </tr>
                ) : (
                  allItems.map((item) => {
                    const isExpense = item.type === 'expense';
                    const key = isExpense ? `exp-${item.data._id}` : `txn-${item.data._id}`;
                    const isExpanded = expandedItem === key;
                    const description = item.data.description;
                    const amount = item.data.amount;
                    const paidBy = isExpense
                      ? (item.data as TripExpense).paidByMemberName
                      : (item.data as Transaction).paidByMemberName;
                    const splits = isExpense
                      ? (item.data as TripExpense).splits
                      : (item.data as Transaction).tripSplits;
                    const hasSplits = splits && splits.length > 0;

                    return (
                      <React.Fragment key={key}>
                        <tr className="hover:bg-gray-700/30">
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {!isExpense && <Link className="w-3 h-3 text-primary-400" title="Linked Transaction" />}
                              {formatDateWithYear(isExpense ? (item.data as TripExpense).date : (item.data as Transaction).transactionDate)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white break-words whitespace-pre-wrap max-w-md">{description}</p>
                            {hasSplits && (
                              <button
                                onClick={() => setExpandedItem(isExpanded ? null : key)}
                                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mt-1"
                              >
                                {splits!.length} splits
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-primary-400">{paidBy || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="text-white font-medium">{formatCurrency(amount)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isExpense && (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setEditingExpense(item.data as TripExpense);
                                    setShowEditExpense(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-primary-400"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteExpenseMutation.mutate(item.data._id)}
                                  className="p-1 text-gray-400 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && hasSplits && (
                          <tr className="bg-gray-800/50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {splits!.map((split: { memberId: string; memberName: string; amount: number }) => (
                                  <Badge key={split.memberId} size="sm">
                                    {split.memberName}: {formatCurrency(split.amount)}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-gray-700">
            {allItems.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No expenses yet. Add expenses or link transactions.
              </div>
            ) : (
              allItems.map((item) => {
                const isExpense = item.type === 'expense';
                const key = isExpense ? `mob-exp-${item.data._id}` : `mob-txn-${item.data._id}`;
                const isExpanded = expandedItem === key;
                const description = item.data.description;
                const amount = item.data.amount;
                const paidBy = isExpense
                  ? (item.data as TripExpense).paidByMemberName
                  : (item.data as Transaction).paidByMemberName;
                const splits = isExpense
                  ? (item.data as TripExpense).splits
                  : (item.data as Transaction).tripSplits;
                const hasSplits = splits && splits.length > 0;

                return (
                  <div key={key} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          {!isExpense && <Link className="w-3 h-3 text-primary-400" />}
                          {formatDateWithYear(isExpense ? (item.data as TripExpense).date : (item.data as Transaction).transactionDate)}
                          <span className="mx-1">•</span>
                          <span className="text-primary-400">{paidBy || '-'}</span>
                        </div>
                        <p className="text-sm text-white break-words">{description}</p>
                        {hasSplits && (
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : key)}
                            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mt-1"
                          >
                            {splits!.length} splits
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold whitespace-nowrap">{formatCurrency(amount)}</span>
                        {isExpense && (
                          <>
                            <button
                              onClick={() => {
                                setEditingExpense(item.data as TripExpense);
                                setShowEditExpense(true);
                              }}
                              className="p-1 text-gray-400 hover:text-primary-400"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteExpenseMutation.mutate(item.data._id)}
                              className="p-1 text-gray-400 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {isExpanded && hasSplits && (
                      <div className="mt-2 pt-2 border-t border-gray-700 flex flex-wrap gap-1">
                        {splits!.map((split: { memberId: string; memberName: string; amount: number }) => (
                          <Badge key={split.memberId} size="sm">
                            {split.memberName}: {formatCurrency(split.amount)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* Breakdown Tab - Full Width Table */}
      {activeTab === 'breakdown' && (
        <Card>
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white">Expense Breakdown</h2>
            <p className="text-sm text-gray-400">
              Detailed view showing what each member owes for each expense
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase border-r border-gray-700 min-w-[100px]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase border-r border-gray-700 min-w-[200px]">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase border-r border-gray-700 min-w-[100px]">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase border-r border-gray-700 min-w-[100px]">Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase border-r border-gray-700 min-w-[80px]">Currency</th>
                  {trip.members.map((member) => (
                    <th
                      key={member._id}
                      className={`px-4 py-3 text-right text-xs font-medium uppercase border-r border-gray-700 min-w-[120px] ${
                        isCurrentUser(member) ? 'text-primary-400 bg-primary-900/20' : 'text-gray-400'
                      }`}
                    >
                      {member.name}
                      {isCurrentUser(member) && ' (Me)'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {allItems.length === 0 ? (
                  <tr>
                    <td colSpan={5 + trip.members.length} className="px-4 py-8 text-center text-gray-400">
                      No expenses yet
                    </td>
                  </tr>
                ) : (
                  allItems.map((item) => {
                    const isExp = item.type === 'expense';
                    const key = isExp ? `breakdown-exp-${item.data._id}` : `breakdown-txn-${item.data._id}`;
                    const description = item.data.description;
                    const amount = item.data.amount;
                    const paidBy = isExp
                      ? (item.data as TripExpense).paidByMemberName
                      : (item.data as Transaction).paidByMemberName;
                    const splits = isExp
                      ? (item.data as TripExpense).splits
                      : (item.data as Transaction).tripSplits;
                    const category = isExp
                      ? (item.data as TripExpense).category || '-'
                      : 'Linked';
                    const currency = isExp
                      ? (item.data as TripExpense).currency
                      : (item.data as Transaction).currency;
                    const paidByMemberId = isExp
                      ? (item.data as TripExpense).paidByMemberId
                      : (item.data as Transaction).paidByMemberId;

                    const getMemberSplit = (memberId: string): number => {
                      if (!splits) return 0;
                      const split = splits.find((s: { memberId: string; amount: number }) => s.memberId === memberId);
                      return split ? split.amount : 0;
                    };

                    return (
                      <tr key={key} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap border-r border-gray-700">
                          {formatDateWithYear(isExp ? (item.data as TripExpense).date : (item.data as Transaction).transactionDate)}
                        </td>
                        <td className="px-4 py-3 text-white border-r border-gray-700">
                          <div>
                            <p className="break-words">{description}</p>
                            <p className="text-xs text-gray-500 mt-1">Paid by: {paidBy || '-'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 border-r border-gray-700">{category}</td>
                        <td className="px-4 py-3 text-right text-white font-medium border-r border-gray-700">
                          {amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400 border-r border-gray-700">{currency}</td>
                        {trip.members.map((member) => {
                          const memberShare = getMemberSplit(member._id!);
                          const isPayer = member._id === paidByMemberId;
                          const isCurrent = isCurrentUser(member);
                          const netAmount = isPayer
                            ? amount - memberShare
                            : -memberShare;

                          return (
                            <td
                              key={member._id}
                              className={`px-4 py-3 text-right border-r border-gray-700 ${
                                isCurrent ? 'bg-primary-900/10' : ''
                              }`}
                            >
                              {netAmount > 0 ? (
                                <span className="text-green-400 font-medium">
                                  {netAmount.toFixed(2)}
                                </span>
                              ) : netAmount < 0 ? (
                                <span className="text-red-400">
                                  {netAmount.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-500">0</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-gray-700/30 border-t-2 border-gray-600 sticky bottom-0">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-white font-semibold border-r border-gray-700">Total</td>
                  <td className="px-4 py-3 text-right text-white font-bold border-r border-gray-700">
                    {grandTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 border-r border-gray-700"></td>
                  {trip.members.map((member) => {
                    let totalNet = 0;

                    allItems.forEach(item => {
                      const isExp = item.type === 'expense';
                      const amount = item.data.amount;
                      const splits = isExp
                        ? (item.data as TripExpense).splits
                        : (item.data as Transaction).tripSplits;
                      const paidById = isExp
                        ? (item.data as TripExpense).paidByMemberId
                        : (item.data as Transaction).paidByMemberId;

                      if (splits) {
                        const split = splits.find((s: { memberId: string; amount: number }) => s.memberId === member._id);
                        const memberShare = split ? split.amount : 0;
                        const isPayer = member._id === paidById;

                        if (isPayer) {
                          totalNet += (amount - memberShare);
                        } else if (memberShare > 0) {
                          totalNet -= memberShare;
                        }
                      }
                    });

                    const isCurrent = isCurrentUser(member);

                    return (
                      <td
                        key={member._id}
                        className={`px-4 py-3 text-right font-semibold border-r border-gray-700 ${
                          isCurrent ? 'bg-primary-900/20' : ''
                        } ${totalNet >= 0 ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <Card>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Trip Members</h2>
              <p className="text-sm text-gray-400">{trip.members.length} members</p>
            </div>
            <Button
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setShowAddMember(true)}
            >
              Add Member
            </Button>
          </div>

          {showAddMember && (
            <div className="p-4 bg-gray-700/50 border-b border-gray-700 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Names (separate multiple names with commas or new lines)
                </label>
                <textarea
                  placeholder="e.g., John, Jane, Bob&#10;or one name per line"
                  value={newMemberNames}
                  onChange={(e) => setNewMemberNames(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
              </div>
              {newMemberNames.trim() && (
                <div className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">
                    Members to add ({newMemberNames.split(/[,\n]/).filter(n => n.trim()).length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {newMemberNames.split(/[,\n]/).filter(n => n.trim()).map((name, index) => (
                      <span key={index} className="px-2 py-1 bg-primary-900/50 text-primary-300 rounded-full text-sm">
                        {name.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddMultipleMembers}
                  disabled={!newMemberNames.trim()}
                  isLoading={isAddingMembers}
                >
                  Add Members
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShowAddMember(false);
                    setNewMemberNames('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="p-4">
            {trip.members.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No members yet. Add members to start tracking expenses.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trip.members.map((member) => {
                  const isCurrent = isCurrentUser(member);
                  return (
                    <div
                      key={member._id}
                      className={`p-4 rounded-lg flex items-center justify-between ${
                        isCurrent ? 'bg-primary-900/30 border border-primary-700' : 'bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {member.name}
                            {isCurrent && <span className="ml-2 text-xs text-primary-400">(Me)</span>}
                          </p>
                          {member.email && (
                            <p className="text-gray-400 text-sm">{member.email}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeMemberMutation.mutate(member._id!)}
                        className="p-1 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Balances Tab */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          <Card>
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Member Balances</h2>
              <p className="text-sm text-gray-400">Who owes what</p>
            </div>

            {!balances ? (
              <div className="p-8 text-center text-gray-400">
                Add expenses to see balances
              </div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {balances.memberBalances.map((member) => {
                    const tripMember = trip.members.find(m => m._id === member.memberId);
                    const isCurrent = tripMember ? isCurrentUser(tripMember) : false;
                    return (
                      <div
                        key={member.memberId}
                        className={`p-4 rounded-lg ${isCurrent ? 'bg-primary-900/30 border border-primary-700' : 'bg-gray-700/50'}`}
                      >
                        <p className="text-white font-medium mb-3">
                          {member.name}
                          {isCurrent && <span className="ml-2 text-xs text-primary-400">(Me)</span>}
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-gray-500">Paid</p>
                            <p className="text-green-400 font-medium">{formatCurrency(member.paid)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Owes</p>
                            <p className="text-red-400 font-medium">{formatCurrency(member.owes)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Balance</p>
                            <p className={`font-medium ${member.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {member.balance >= 0 ? '+' : ''}{formatCurrency(member.balance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {balances && balances.settlements.length > 0 && (
            <Card>
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">Settlements</h2>
                <p className="text-sm text-gray-400">How to settle up</p>
              </div>
              <div className="p-4 space-y-3">
                {balances.settlements.map((settlement, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-700/50 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 font-medium">{settlement.fromName}</span>
                      <ArrowRight className="w-5 h-5 text-gray-500" />
                      <span className="text-green-400 font-medium">{settlement.toName}</span>
                    </div>
                    <span className="text-white font-semibold text-lg">
                      {formatCurrency(settlement.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {balances && balances.settlements.length === 0 && balances.memberBalances.length > 0 && (
            <div className="text-center text-gray-400 py-4">
              All settled up! No payments needed.
            </div>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          tripId={tripId!}
          trip={trip}
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
        />
      )}

      {/* Edit Expense Modal */}
      {showEditExpense && editingExpense && (
        <EditExpenseModal
          tripId={tripId!}
          trip={trip}
          expense={editingExpense}
          isOpen={showEditExpense}
          onClose={() => {
            setShowEditExpense(false);
            setEditingExpense(null);
          }}
          onSave={(data) => updateExpenseMutation.mutate({ expenseId: editingExpense._id, data })}
          isLoading={updateExpenseMutation.isPending}
        />
      )}

      {/* Status Menu Modal */}
      {trip && (
        <Modal isOpen={showStatusMenu} onClose={() => setShowStatusMenu(false)} title="Change Trip Status">
          <div className="space-y-3">
            <button
              onClick={() => updateTripMutation.mutate({ status: 'active' })}
              className={`w-full p-4 rounded-lg flex items-center gap-3 transition-colors ${
                (trip.status || 'active') === 'active'
                  ? 'bg-green-900/30 border border-green-700'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-900/30">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-medium ${(trip.status || 'active') === 'active' ? 'text-green-400' : 'text-white'}`}>
                  Active
                </p>
                <p className="text-sm text-gray-400">Trip is ongoing</p>
              </div>
              {(trip.status || 'active') === 'active' && (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
            </button>

            <button
              onClick={() => updateTripMutation.mutate({ status: 'completed' })}
              className={`w-full p-4 rounded-lg flex items-center gap-3 transition-colors ${
                trip.status === 'completed'
                  ? 'bg-primary-900/30 border border-primary-700'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary-900/30">
                <CheckCircle className="w-5 h-5 text-primary-400" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-medium ${trip.status === 'completed' ? 'text-primary-400' : 'text-white'}`}>
                  Completed
                </p>
                <p className="text-sm text-gray-400">Trip has ended</p>
              </div>
              {trip.status === 'completed' && (
                <CheckCircle className="w-5 h-5 text-primary-400" />
              )}
            </button>

            <button
              onClick={() => updateTripMutation.mutate({ status: 'cancelled' })}
              className={`w-full p-4 rounded-lg flex items-center gap-3 transition-colors ${
                trip.status === 'cancelled'
                  ? 'bg-red-900/30 border border-red-700'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-900/30">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-left flex-1">
                <p className={`font-medium ${trip.status === 'cancelled' ? 'text-red-400' : 'text-white'}`}>
                  Cancelled
                </p>
                <p className="text-sm text-gray-400">Trip was cancelled</p>
              </div>
              {trip.status === 'cancelled' && (
                <CheckCircle className="w-5 h-5 text-red-400" />
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddExpenseModal({
  tripId,
  trip,
  isOpen,
  onClose,
}: {
  tripId: string;
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: trip.defaultCurrency,
    exchangeRate: trip.inrRate.toString(),
    paidByMemberId: '',
    splitType: 'equal' as 'equal' | 'exact',
    date: new Date().toISOString().split('T')[0],
    category: '',
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    trip.members.map(m => m._id!)
  );
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== memberId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  const selectAllMembers = () => {
    setSelectedMemberIds(trip.members.map(m => m._id!));
  };

  const addExpenseMutation = useMutation({
    mutationFn: () => {
      let splits;
      if (formData.splitType === 'exact') {
        splits = Object.entries(customSplits)
          .filter(([memberId]) => selectedMemberIds.includes(memberId))
          .map(([memberId, amount]) => ({
            memberId,
            amount: parseFloat(amount) || 0,
          }));
      }

      return tripService.addExpense(tripId, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        exchangeRate: parseFloat(formData.exchangeRate),
        paidByMemberId: formData.paidByMemberId,
        splitType: formData.splitType,
        splits,
        selectedMemberIds: formData.splitType === 'equal' ? selectedMemberIds : undefined,
        date: formData.date,
        category: formData.category || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances', tripId] });
      onClose();
    },
  });

  const splitAmount = formData.amount && selectedMemberIds.length > 0
    ? parseFloat(formData.amount) / selectedMemberIds.length
    : 0;

  const customSplitsTotal = Object.entries(customSplits)
    .filter(([memberId]) => selectedMemberIds.includes(memberId))
    .reduce((sum, [, amount]) => sum + (parseFloat(amount) || 0), 0);

  const expenseAmount = parseFloat(formData.amount) || 0;
  const splitsDifference = Math.abs(customSplitsTotal - expenseAmount);
  const splitsMatch = splitsDifference < 0.01;

  const isCustomSplitValid = formData.splitType === 'equal' || splitsMatch;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense" size="full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isCustomSplitValid) return;
          addExpenseMutation.mutate();
        }}
        className="space-y-4"
      >
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="e.g., Dinner at restaurant"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
            />
            <Input
              label="Rate to INR"
              type="number"
              step="0.01"
              value={formData.exchangeRate}
              onChange={(e) => setFormData({ ...formData, exchangeRate: e.target.value })}
            />
          </div>
        </div>

        <Select
          label="Paid by"
          options={[
            { value: '', label: 'Select who paid' },
            ...trip.members.map((m) => ({ value: m._id!, label: m.name })),
          ]}
          value={formData.paidByMemberId}
          onChange={(value) => setFormData({ ...formData, paidByMemberId: value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <Input
            label="Category (optional)"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="e.g., Food, Transport"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Split Type</label>
          <div className="flex gap-4 sm:gap-6">
            <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
              <input
                type="radio"
                checked={formData.splitType === 'equal'}
                onChange={() => setFormData({ ...formData, splitType: 'equal' })}
                className="text-primary-600 w-4 h-4"
              />
              Equal Split
            </label>
            <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
              <input
                type="radio"
                checked={formData.splitType === 'exact'}
                onChange={() => setFormData({ ...formData, splitType: 'exact' })}
                className="text-primary-600 w-4 h-4"
              />
              Custom Amounts
            </label>
          </div>
        </div>

        <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Split with ({selectedMemberIds.length} of {trip.members.length})
            </label>
            {selectedMemberIds.length < trip.members.length && (
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Select All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trip.members.map(member => (
              <label
                key={member._id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  selectedMemberIds.includes(member._id!)
                    ? 'bg-primary-900/30 border border-primary-600'
                    : 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(member._id!)}
                  onChange={() => toggleMember(member._id!)}
                  className="rounded border-gray-500 text-primary-600 focus:ring-primary-500 bg-gray-700"
                />
                <span className="text-sm text-gray-200">{member.name}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.splitType === 'equal' && formData.amount && selectedMemberIds.length > 0 && (
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Each selected person pays:</p>
            <p className="text-white font-semibold">
              {formData.currency} {splitAmount.toFixed(2)}
            </p>
          </div>
        )}

        {formData.splitType === 'exact' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Enter amount for each selected person:</p>
            {trip.members
              .filter(m => selectedMemberIds.includes(m._id!))
              .map((member) => (
                <div key={member._id} className="flex items-center gap-3">
                  <span className="text-gray-300 w-32 truncate">{member.name}</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={customSplits[member._id!] || ''}
                    onChange={(e) =>
                      setCustomSplits({ ...customSplits, [member._id!]: e.target.value })
                    }
                  />
                </div>
              ))}

            <div className={`p-3 rounded-lg ${splitsMatch ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expense Amount:</span>
                <span className="text-white font-medium">{formData.currency} {expenseAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Total Split:</span>
                <span className={`font-medium ${splitsMatch ? 'text-green-400' : 'text-red-400'}`}>
                  {formData.currency} {customSplitsTotal.toFixed(2)}
                </span>
              </div>
              {!splitsMatch && expenseAmount > 0 && (
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-600">
                  <span className="text-red-400">Difference:</span>
                  <span className="text-red-400 font-medium">
                    {customSplitsTotal > expenseAmount ? '+' : '-'}{formData.currency} {splitsDifference.toFixed(2)}
                  </span>
                </div>
              )}
              {!splitsMatch && expenseAmount > 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Split total must equal the expense amount to save.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={addExpenseMutation.isPending}
            disabled={!formData.description || !formData.amount || !formData.paidByMemberId || selectedMemberIds.length === 0 || !isCustomSplitValid}
          >
            Add Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditExpenseModal({
  tripId,
  trip,
  expense,
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  tripId: string;
  trip: Trip;
  expense: TripExpense;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const extractId = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id.toString();
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return value.toString();
  };

  const getInitialFormData = () => ({
    description: expense?.description || '',
    amount: expense?.amount?.toString() || '0',
    currency: expense?.currency || trip?.defaultCurrency || 'INR',
    paidByMemberId: extractId(expense?.paidByMemberId),
    date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    category: expense?.category || '',
    splitType: (expense?.splitType || 'equal') as 'equal' | 'exact',
  });

  const getInitialSplits = (): Record<string, string> => {
    const splits: Record<string, string> = {};
    if (expense?.splits && Array.isArray(expense.splits)) {
      expense.splits.forEach(s => {
        const memberId = extractId(s.memberId);
        if (memberId) {
          splits[memberId] = s.amount?.toString() || '0';
        }
      });
    }
    return splits;
  };

  const getInitialMemberIds = (): string[] => {
    if (expense?.splits && Array.isArray(expense.splits)) {
      return expense.splits.map(s => extractId(s.memberId)).filter(Boolean);
    }
    return trip?.members?.map(m => m._id!) || [];
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(getInitialMemberIds);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(getInitialSplits);

  useEffect(() => {
    if (expense && trip) {
      setFormData(getInitialFormData());
      setSelectedMemberIds(getInitialMemberIds());
      setCustomSplits(getInitialSplits());
    }
  }, [expense?._id, trip?._id]);

  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== memberId));
      const newSplits = { ...customSplits };
      delete newSplits[memberId];
      setCustomSplits(newSplits);
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  const selectAllMembers = () => {
    setSelectedMemberIds(trip.members.map(m => m._id!));
  };

  const expenseAmount = parseFloat(formData.amount) || 0;
  const splitAmount = expenseAmount / (selectedMemberIds.length || 1);
  const customSplitsTotal = Object.values(customSplits).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const splitsMatch = formData.splitType === 'equal' || Math.abs(customSplitsTotal - expenseAmount) < 0.01;
  const splitsDifference = Math.abs(customSplitsTotal - expenseAmount);
  const isCustomSplitValid = formData.splitType === 'equal' || splitsMatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount || !formData.paidByMemberId || selectedMemberIds.length === 0) {
      return;
    }

    if (!isCustomSplitValid) {
      return;
    }

    let splits;
    if (formData.splitType === 'equal') {
      const equalAmount = expenseAmount / selectedMemberIds.length;
      splits = selectedMemberIds.map(memberId => {
        const member = trip.members.find(m => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: equalAmount,
        };
      });
    } else {
      splits = selectedMemberIds.map(memberId => {
        const member = trip.members.find(m => m._id === memberId);
        return {
          memberId,
          memberName: member?.name || '',
          amount: parseFloat(customSplits[memberId] || '0'),
        };
      });
    }

    onSave({
      description: formData.description,
      amount: expenseAmount,
      currency: formData.currency,
      paidByMemberId: formData.paidByMemberId,
      date: formData.date,
      category: formData.category,
      splitType: formData.splitType,
      splits,
      selectedMemberIds,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Expense" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />

          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />

          <Select
            label="Paid By"
            value={formData.paidByMemberId}
            onChange={(e) => setFormData({ ...formData, paidByMemberId: e.target.value })}
            required
          >
            <option value="">Select who paid...</option>
            {trip.members.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </Select>

          <Input
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <Input
            label="Category"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="e.g., Food, Transport"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Split Type</label>
          <div className="flex gap-4 sm:gap-6">
            <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
              <input
                type="radio"
                checked={formData.splitType === 'equal'}
                onChange={() => setFormData({ ...formData, splitType: 'equal' })}
                className="text-primary-600 w-4 h-4"
              />
              Equal Split
            </label>
            <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
              <input
                type="radio"
                checked={formData.splitType === 'exact'}
                onChange={() => setFormData({ ...formData, splitType: 'exact' })}
                className="text-primary-600 w-4 h-4"
              />
              Custom Amounts
            </label>
          </div>
        </div>

        <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-300">
              Split with ({selectedMemberIds.length} of {trip.members.length})
            </label>
            {selectedMemberIds.length < trip.members.length && (
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Select All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {trip.members.map(member => (
              <label
                key={member._id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  selectedMemberIds.includes(member._id!)
                    ? 'bg-primary-900/30 border border-primary-600'
                    : 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(member._id!)}
                  onChange={() => toggleMember(member._id!)}
                  className="rounded border-gray-500 text-primary-600 focus:ring-primary-500 bg-gray-700"
                />
                <span className="text-sm text-gray-200">{member.name}</span>
              </label>
            ))}
          </div>
        </div>

        {formData.splitType === 'equal' && formData.amount && selectedMemberIds.length > 0 && (
          <div className="p-3 bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Each selected person pays:</p>
            <p className="text-white font-semibold">
              {formData.currency} {splitAmount.toFixed(2)}
            </p>
          </div>
        )}

        {formData.splitType === 'exact' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Enter amount for each selected person:</p>
            {trip.members
              .filter(m => selectedMemberIds.includes(m._id!))
              .map((member) => (
                <div key={member._id} className="flex items-center gap-3">
                  <span className="text-gray-300 w-32 truncate">{member.name}</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={customSplits[member._id!] || ''}
                    onChange={(e) =>
                      setCustomSplits({ ...customSplits, [member._id!]: e.target.value })
                    }
                  />
                </div>
              ))}

            <div className={`p-3 rounded-lg ${splitsMatch ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expense Amount:</span>
                <span className="text-white font-medium">{formData.currency} {expenseAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Total Split:</span>
                <span className={`font-medium ${splitsMatch ? 'text-green-400' : 'text-red-400'}`}>
                  {formData.currency} {customSplitsTotal.toFixed(2)}
                </span>
              </div>
              {!splitsMatch && expenseAmount > 0 && (
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-600">
                  <span className="text-red-400">Difference:</span>
                  <span className="text-red-400 font-medium">
                    {customSplitsTotal > expenseAmount ? '+' : '-'}{formData.currency} {splitsDifference.toFixed(2)}
                  </span>
                </div>
              )}
              {!splitsMatch && expenseAmount > 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Split total must equal the expense amount to save.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!formData.description || !formData.amount || !formData.paidByMemberId || selectedMemberIds.length === 0 || !isCustomSplitValid}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
