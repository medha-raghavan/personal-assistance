import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, X, ChevronDown, ChevronUp, CheckSquare, Square, Calendar, Tag, FolderOpen, Upload as UploadIcon, FileText, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, Button, Input, Select, Badge, Modal } from '../components/common';
import { transactionService, TransactionFilters } from '../services/transaction.service';
import { sectionService } from '../services/section.service';
import { categoryService } from '../services/category.service';
import { tripService } from '../services/trip.service';
import { uploadService } from '../services/upload.service';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Transaction, Section, Category, Trip, TripMember, ParsedTransaction } from '../types';
import { useAuthStore } from '../store/authStore';

function formatDateWithYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface EditableTransaction extends ParsedTransaction {
  isSelected: boolean;
  editedCategoryId?: string;
  editedCategoryName?: string;
}

export function Transactions() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({
    page: 1,
    limit: 100,
    sortBy: 'transactionDate',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripService.getAll(),
  });
  
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => transactionService.getAll(filters),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => transactionService.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setSelectedIds(new Set());
    },
  });
  
  const sections = sectionsData || [];
  const categories = categoriesData || [];
  const trips = tripsData || [];
  const transactions = data?.transactions || [];
  const pagination = data?.pagination;

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t._id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const getCategoryInfo = (categoryId?: string | Category) => {
    if (!categoryId) return null;
    if (typeof categoryId === 'object') return categoryId;
    return categories.find(c => c._id === categoryId);
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 100,
      sortBy: 'transactionDate',
      sortOrder: 'desc',
    });
  };

  const totals = data?.totals;

  const handleSort = (column: string) => {
    if (filters.sortBy === column) {
      setFilters({
        ...filters,
        sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      setFilters({
        ...filters,
        sortBy: column,
        sortOrder: 'desc',
        page: 1,
      });
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (filters.sortBy !== column) return null;
    return filters.sortOrder === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  const hasActiveFilters = !!(
    filters.keyword ||
    filters.sectionId ||
    (filters.type && filters.type !== 'all') ||
    filters.categoryId ||
    filters.startDate ||
    filters.endDate ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.tags?.length ||
    filters.tripId
  );
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Transactions</h1>
          <p className="text-sm sm:text-base text-gray-400">
            {pagination?.totalCount || 0} transactions found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<UploadIcon className="w-4 h-4" />} onClick={() => setShowUploadModal(true)} size="sm" className="sm:size-default">
            <span className="hidden sm:inline">Upload Statement</span>
            <span className="sm:hidden">Upload</span>
          </Button>
          <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)} size="sm" className="sm:size-default">
            <span className="hidden sm:inline">Add Transaction</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-2 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400">Income</p>
            <p className="text-sm sm:text-xl font-bold text-green-400">+{formatCurrency(totals.totalCredit)}</p>
          </div>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-2 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-400">Expense</p>
            <p className="text-sm sm:text-xl font-bold text-red-400">-{formatCurrency(totals.totalDebit)}</p>
          </div>
          <div className={`${totals.netTotal >= 0 ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800'} border rounded-lg p-2 sm:p-4`}>
            <p className="text-xs sm:text-sm text-gray-400">Net</p>
            <p className={`text-sm sm:text-xl font-bold ${totals.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totals.netTotal >= 0 ? '+' : ''}{formatCurrency(totals.netTotal)}
            </p>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <Card className="bg-primary-900/30 border-primary-600">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary-400" />
              <span className="text-white font-medium">
                {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Edit2 className="w-4 h-4" />}
                onClick={() => setShowBulkEditModal(true)}
              >
                Bulk Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={() => {
                  if (confirm(`Delete ${selectedIds.size} transaction(s)?`)) {
                    bulkDeleteMutation.mutate(Array.from(selectedIds));
                  }
                }}
                isLoading={bulkDeleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}
      
      <Card padding="none">
        <div className="p-3 sm:p-4 border-b border-gray-700">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <Input
                placeholder="Search..."
                leftIcon={<Search className="w-4 h-4" />}
                value={filters.keyword || ''}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value, page: 1 })}
              />
            </div>
            
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
              size="sm"
              className="whitespace-nowrap"
            >
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && <span className="ml-1">({Object.values(filters).filter(v => v && v !== 'all' && v !== 'transactionDate' && v !== 'desc' && v !== 1 && v !== 100).length - 1})</span>}
            </Button>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Clear</span>
              </Button>
            )}
          </div>
        </div>
        
        {showFilters && (
          <div className="p-4 border-b border-gray-700 bg-gray-800/50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                label="Section"
                options={[
                  { value: '', label: 'All Sections' },
                  ...sections.map((s) => ({ value: s._id, label: s.name })),
                ]}
                value={filters.sectionId || ''}
                onChange={(value) => setFilters({ ...filters, sectionId: value || undefined, page: 1 })}
              />
              
              <Select
                label="Category"
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((c) => ({ value: c._id, label: c.name })),
                ]}
                value={filters.categoryId || ''}
                onChange={(value) => setFilters({ ...filters, categoryId: value || undefined, page: 1 })}
              />
              
              <Select
                label="Type"
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'credit', label: 'Income' },
                  { value: 'debit', label: 'Expense' },
                ]}
                value={filters.type || 'all'}
                onChange={(value) => setFilters({ ...filters, type: value as 'all' | 'credit' | 'debit', page: 1 })}
              />
              
              <Select
                label="Trip"
                options={[
                  { value: '', label: 'All / No Trip' },
                  ...trips.map((t) => ({ value: t._id, label: t.name })),
                ]}
                value={filters.tripId || ''}
                onChange={(value) => setFilters({ ...filters, tripId: value || undefined, page: 1 })}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined, page: 1 })}
              />
              <Input
                label="End Date"
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined, page: 1 })}
              />
              <Input
                label="Min Amount"
                type="number"
                placeholder="0"
                value={filters.minAmount || ''}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value ? parseFloat(e.target.value) : undefined, page: 1 })}
              />
              <Input
                label="Max Amount"
                type="number"
                placeholder="No limit"
                value={filters.maxAmount || ''}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value ? parseFloat(e.target.value) : undefined, page: 1 })}
              />
            </div>
            
            <div>
              <Input
                label="Filter by Tags (comma separated)"
                placeholder="e.g., food, travel, shopping"
                value={filters.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setFilters({ ...filters, tags: tags.length > 0 ? tags : undefined, page: 1 });
                }}
              />
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50 border-b border-gray-700">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left w-8 sm:w-10">
                  <button
                    onClick={toggleAllSelection}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                    title={selectedIds.size === transactions.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedIds.size === transactions.length && transactions.length > 0 ? (
                      <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
                    ) : (
                      <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                </th>
                <th 
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('transactionDate')}
                >
                  Date <SortIcon column="transactionDate" />
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase">
                  Description
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden md:table-cell cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('sectionId')}
                >
                  Section <SortIcon column="sectionId" />
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('categoryId')}
                >
                  Category <SortIcon column="categoryId" />
                </th>
                <th 
                  className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  Amt <span className="hidden sm:inline">Amount</span> <SortIcon column="amount" />
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-400 uppercase">
                  <span className="sr-only sm:not-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const section = transaction.sectionId as Section;
                  const category = getCategoryInfo(transaction.categoryId);
                  const isExpanded = expandedRow === transaction._id;
                  const isSelected = selectedIds.has(transaction._id);
                  
                  return (
                    <React.Fragment key={transaction._id}>
                      <tr className={`hover:bg-gray-700/30 ${isSelected ? 'bg-primary-900/20' : ''}`}>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 w-8 sm:w-10">
                          <button
                            onClick={() => toggleSelection(transaction._id)}
                            className="text-gray-400 hover:text-gray-200 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400" />
                            ) : (
                              <Square className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-300 whitespace-nowrap">
                          {formatDateWithYear(transaction.transactionDate)}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <div className="flex items-start gap-1 sm:gap-2">
                            <div
                              className={`p-0.5 sm:p-1 rounded flex-shrink-0 mt-0.5 ${
                                transaction.type === 'credit'
                                  ? 'bg-green-900/50 text-green-400'
                                  : 'bg-red-900/50 text-red-400'
                              }`}
                            >
                              {transaction.type === 'credit' ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm text-gray-200 break-words whitespace-pre-wrap line-clamp-2 sm:line-clamp-none">
                                {transaction.description}
                              </p>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                                <span className="md:hidden">
                                  <Badge size="sm">{section?.name || 'Unknown'}</Badge>
                                </span>
                                {category && (
                                  <span className="lg:hidden">
                                    <Badge variant="info" size="sm">{category.name}</Badge>
                                  </span>
                                )}
                                {transaction.tags.length > 0 && (
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : transaction._id)}
                                    className="text-[10px] sm:text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                  >
                                    {transaction.tags.length} tags
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <Badge>{section?.name || 'Unknown'}</Badge>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {category && (
                            <Badge variant="info" size="sm">{category.name}</Badge>
                          )}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right whitespace-nowrap">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              transaction.type === 'credit' ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {transaction.type === 'credit' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                        <td className="px-1 sm:px-4 py-2 sm:py-3 text-right">
                          <div className="flex items-center justify-end gap-0 sm:gap-1">
                            <button
                              onClick={() => setEditingTransaction(transaction)}
                              className="p-1 sm:p-1.5 text-gray-400 hover:text-primary-400 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this transaction?')) {
                                  deleteMutation.mutate(transaction._id);
                                }
                              }}
                              className="p-1 sm:p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && transaction.tags.length > 0 && (
                        <tr className="bg-gray-800/30">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex flex-wrap gap-1 ml-10">
                              {transaction.tags.map((tag) => (
                                <Badge key={tag} size="sm">{tag}</Badge>
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
        
        {pagination && pagination.totalPages > 1 && (
          <div className="p-3 sm:p-4 border-t border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-gray-400">
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      
      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        sections={sections}
        categories={categories}
        trips={trips}
      />
      
      {editingTransaction && (
        <TransactionModal
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          sections={sections}
          categories={categories}
          trips={trips}
        />
      )}

      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        selectedCount={selectedIds.size}
        selectedIds={Array.from(selectedIds)}
        categories={categories}
        onSuccess={() => {
          setSelectedIds(new Set());
          setShowBulkEditModal(false);
        }}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        sections={sections.filter(s => s.uploadEnabled)}
        categories={categories}
        onSuccess={() => {
          setShowUploadModal(false);
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['sections'] });
        }}
      />
    </div>
  );
}

function TransactionModal({
  isOpen,
  onClose,
  transaction,
  sections,
  categories,
  trips,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction;
  sections: Section[];
  categories: Category[];
  trips: Trip[];
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isEditing = !!transaction;

  const findCurrentUserMember = (trip: Trip): TripMember | undefined => {
    if (!user) return undefined;
    const userName = user.name.toLowerCase();
    const userEmail = user.email.toLowerCase();
    return trip.members.find(m => {
      const memberName = m.name.toLowerCase();
      const memberEmail = m.email?.toLowerCase() || '';
      return memberName === userName || memberName === 'medha' || memberEmail === userEmail;
    });
  };
  
  const [formData, setFormData] = useState({
    sectionId: (transaction?.sectionId as Section)?._id || (transaction?.sectionId as string) || '',
    categoryId: (transaction?.categoryId as Category)?._id || (transaction?.categoryId as string) || '',
    tripId: (transaction?.tripId as Trip)?._id || (transaction?.tripId as string) || '',
    transactionDate: transaction ? new Date(transaction.transactionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: transaction?.amount.toString() || '',
    type: transaction?.type || 'debit' as 'credit' | 'debit',
    description: transaction?.description || '',
    tags: transaction?.tags.join(', ') || '',
    paidByMemberId: transaction?.paidByMemberId || '',
    selectedMemberIds: transaction?.tripSplits?.map(s => s.memberId) || [] as string[],
  });

  React.useEffect(() => {
    if (transaction) {
      setFormData({
        sectionId: (transaction.sectionId as Section)?._id || (transaction.sectionId as string) || '',
        categoryId: (transaction.categoryId as Category)?._id || (transaction.categoryId as string) || '',
        tripId: (transaction.tripId as Trip)?._id || (transaction.tripId as string) || '',
        transactionDate: new Date(transaction.transactionDate).toISOString().split('T')[0],
        amount: transaction.amount.toString(),
        type: transaction.type,
        description: transaction.description,
        tags: transaction.tags.join(', '),
        paidByMemberId: transaction.paidByMemberId || '',
        selectedMemberIds: transaction.tripSplits?.map(s => s.memberId) || [],
      });
    }
  }, [transaction]);

  const selectedTrip = trips.find(t => t._id === formData.tripId);

  const toggleMember = (memberId: string) => {
    const newIds = formData.selectedMemberIds.includes(memberId)
      ? formData.selectedMemberIds.filter(id => id !== memberId)
      : [...formData.selectedMemberIds, memberId];
    setFormData({ ...formData, selectedMemberIds: newIds });
  };

  const selectAllMembers = () => {
    if (selectedTrip) {
      setFormData({
        ...formData,
        selectedMemberIds: selectedTrip.members.map(m => m._id!),
      });
    }
  };
  
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      transactionService.create({
        sectionId: data.sectionId,
        transactionDate: data.transactionDate,
        amount: parseFloat(data.amount),
        type: data.type,
        description: data.description,
        categoryId: data.categoryId || undefined,
        tripId: data.tripId || undefined,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      onClose();
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const amount = transaction?.amount || parseFloat(data.amount);
      let tripSplits: Array<{ memberId: string; memberName: string; amount: number }> | null = null;
      let paidByMemberId: string | null = null;
      let paidByMemberName: string | null = null;

      if (data.tripId && selectedTrip && data.selectedMemberIds.length > 0) {
        const splitAmount = amount / data.selectedMemberIds.length;
        tripSplits = data.selectedMemberIds.map(memberId => {
          const member = selectedTrip.members.find(m => m._id === memberId);
          return {
            memberId,
            memberName: member?.name || 'Unknown',
            amount: splitAmount,
          };
        });
        
        if (data.paidByMemberId) {
          const paidByMember = selectedTrip.members.find(m => m._id === data.paidByMemberId);
          paidByMemberId = data.paidByMemberId;
          paidByMemberName = paidByMember?.name || null;
        }
      }

      return transactionService.update(transaction!._id, {
        description: data.description,
        transactionDate: data.transactionDate,
        categoryId: data.categoryId || null,
        tripId: data.tripId || null,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
        tripSplits,
        paidByMemberId,
        paidByMemberName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['trip-balances'] });
      queryClient.invalidateQueries({ queryKey: ['trip-linked-transactions'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Edit Transaction' : 'Add Transaction'} size="full">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEditing && (
          <>
            <Select
              label="Section"
              options={[
                { value: '', label: 'Select section' },
                ...sections.map((s) => ({ value: s._id, label: s.name })),
              ]}
              value={formData.sectionId}
              onChange={(value) => setFormData({ ...formData, sectionId: value })}
            />
            
            <Input
              label="Date"
              type="date"
              value={formData.transactionDate}
              onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              required
            />
            
            <div className="flex gap-4 sm:gap-6">
              <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
                <input
                  type="radio"
                  name="type"
                  checked={formData.type === 'debit'}
                  onChange={() => setFormData({ ...formData, type: 'debit' })}
                  className="text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>Expense</span>
              </label>
              <label className="flex items-center gap-2 text-sm sm:text-base text-gray-300">
                <input
                  type="radio"
                  name="type"
                  checked={formData.type === 'credit'}
                  onChange={() => setFormData({ ...formData, type: 'credit' })}
                  className="text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span>Income</span>
              </label>
            </div>
            
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </>
        )}

        {isEditing && (
          <Input
            label="Date"
            type="date"
            value={formData.transactionDate}
            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
            required
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm sm:text-base"
            rows={3}
            required={!isEditing}
          />
        </div>

        <Select
          label="Category"
          options={[
            { value: '', label: 'No category' },
            ...categories.map((c) => ({ value: c._id, label: c.name })),
          ]}
          value={formData.categoryId}
          onChange={(value) => setFormData({ ...formData, categoryId: value })}
        />
        
        <Select
          label="Link to Trip"
          options={[
            { value: '', label: 'No trip' },
            ...trips.map((t) => ({ value: t._id, label: t.name })),
          ]}
          value={formData.tripId}
          onChange={(value) => {
            const trip = trips.find(t => t._id === value);
            let newTags = formData.tags;
            let paidByMemberId = '';
            
            if (trip) {
              const tripTag = `trip:${trip.name.toLowerCase().replace(/\s+/g, '-')}`;
              if (!formData.tags.includes(tripTag)) {
                newTags = formData.tags ? `${formData.tags}, ${tripTag}` : tripTag;
              }
              // Auto-select current user as "paid by" since they're linking their transaction
              const currentUserMember = findCurrentUserMember(trip);
              if (currentUserMember) {
                paidByMemberId = currentUserMember._id!;
              }
            }
            setFormData({
              ...formData,
              tripId: value,
              tags: newTags,
              selectedMemberIds: trip ? trip.members.map(m => m._id!) : [],
              paidByMemberId,
            });
          }}
        />

        {selectedTrip && selectedTrip.members.length > 0 && (
          <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">Split with Members</label>
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selectedTrip.members.map(member => (
                <label
                  key={member._id}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    formData.selectedMemberIds.includes(member._id!)
                      ? 'bg-primary-900/30 border border-primary-600'
                      : 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.selectedMemberIds.includes(member._id!)}
                    onChange={() => toggleMember(member._id!)}
                    className="rounded border-gray-500 text-primary-600 focus:ring-primary-500 bg-gray-700"
                  />
                  <span className="text-sm text-gray-200">{member.name}</span>
                </label>
              ))}
            </div>
            {formData.selectedMemberIds.length > 0 && (
              <p className="text-xs text-gray-400">
                Split equally: {formatCurrency(transaction?.amount ? transaction.amount / formData.selectedMemberIds.length : 0)} each
              </p>
            )}

            <Select
              label="Who paid?"
              options={[
                { value: '', label: 'Select who paid' },
                ...selectedTrip.members.map((m) => ({ value: m._id!, label: m.name })),
              ]}
              value={formData.paidByMemberId}
              onChange={(value) => setFormData({ ...formData, paidByMemberId: value })}
            />
          </div>
        )}

        <Input
          label="Tags (comma separated)"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="e.g., food, travel, personal"
        />
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
            {isEditing ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BulkEditModal({
  isOpen,
  onClose,
  selectedCount,
  selectedIds,
  categories,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: string[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'date' | 'category' | 'tags'>('date');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [clearCategory, setClearCategory] = useState(false);
  const [tags, setTags] = useState('');
  const [tagAction, setTagAction] = useState<'add' | 'remove' | 'replace'>('add');

  const bulkUpdateMutation = useMutation({
    mutationFn: () => {
      const updates: {
        transactionDate?: string;
        categoryId?: string | null;
        tags?: string[];
        tagAction?: 'add' | 'remove' | 'replace';
      } = {};

      if (activeTab === 'date' && date) {
        updates.transactionDate = date;
      } else if (activeTab === 'category') {
        updates.categoryId = clearCategory ? null : (categoryId || undefined);
      } else if (activeTab === 'tags' && tags.trim()) {
        updates.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
        updates.tagAction = tagAction;
      }

      return transactionService.bulkUpdate(selectedIds, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setDate('');
      setCategoryId('');
      setClearCategory(false);
      setTags('');
      onSuccess();
    },
  });

  const canSubmit = () => {
    if (activeTab === 'date') return !!date;
    if (activeTab === 'category') return clearCategory || !!categoryId;
    if (activeTab === 'tags') return !!tags.trim();
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit()) {
      bulkUpdateMutation.mutate();
    }
  };

  const tabs = [
    { id: 'date', label: 'Date', icon: Calendar },
    { id: 'category', label: 'Category', icon: FolderOpen },
    { id: 'tags', label: 'Tags', icon: Tag },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Edit (${selectedCount} selected)`} size="full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex border-b border-gray-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="min-h-[120px]">
          {activeTab === 'date' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Set a new date for all {selectedCount} selected transaction(s).
              </p>
              <Input
                label="New Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'category' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Change the category for all {selectedCount} selected transaction(s).
              </p>
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={clearCategory}
                  onChange={(e) => {
                    setClearCategory(e.target.checked);
                    if (e.target.checked) setCategoryId('');
                  }}
                  className="rounded border-gray-500 text-primary-600 focus:ring-primary-500 bg-gray-700"
                />
                <span>Clear category (remove from all)</span>
              </label>
              {!clearCategory && (
                <Select
                  label="New Category"
                  options={[
                    { value: '', label: 'Select category' },
                    ...categories.map((c) => ({ value: c._id, label: c.name })),
                  ]}
                  value={categoryId}
                  onChange={(value) => setCategoryId(value)}
                />
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Modify tags for all {selectedCount} selected transaction(s).
              </p>
              <div className="flex gap-2">
                {(['add', 'remove', 'replace'] as const).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setTagAction(action)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      tagAction === action
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </button>
                ))}
              </div>
              <Input
                label={`Tags to ${tagAction}`}
                placeholder="e.g., food, travel, shopping"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                helperText={
                  tagAction === 'add'
                    ? 'These tags will be added to selected transactions'
                    : tagAction === 'remove'
                    ? 'These tags will be removed from selected transactions'
                    : 'These tags will replace all existing tags'
                }
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit()}
            isLoading={bulkUpdateMutation.isPending}
          >
            Update {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UploadModal({
  isOpen,
  onClose,
  sections,
  categories,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  categories: Category[];
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedSection, setSelectedSection] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [step, setStep] = useState<'select' | 'preview' | 'complete'>('select');
  const [editableTransactions, setEditableTransactions] = useState<EditableTransaction[]>([]);
  const [uploadId, setUploadId] = useState<string>('');

  const uploadMutation = useMutation({
    mutationFn: ({ file, sectionId }: { file: File; sectionId: string }) =>
      uploadService.uploadStatement(file, sectionId),
    onSuccess: async (data) => {
      setUploadId(data.uploadId);
      const previewData = await uploadService.getPreview(data.uploadId);
      setEditableTransactions(
        previewData.transactions.map((txn: ParsedTransaction) => ({
          ...txn,
          isSelected: !txn.isDuplicate,
          editedCategoryId: txn.categoryId,
          editedCategoryName: txn.categoryName,
        }))
      );
      setStep('preview');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ uploadId, selectedKeys, categoryUpdates }: {
      uploadId: string;
      selectedKeys: string[];
      categoryUpdates: Record<string, string>;
    }) => uploadService.confirmUpload(uploadId, {
      skipDuplicates: true,
      selectedTransactions: selectedKeys,
      categoryUpdates,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setStep('complete');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const handleUpload = () => {
    if (uploadedFile && selectedSection) {
      uploadMutation.mutate({ file: uploadedFile, sectionId: selectedSection });
    }
  };

  const handleConfirm = () => {
    const selectedKeys = editableTransactions
      .filter((t) => t.isSelected)
      .map((t) => t.compositeKey);

    const categoryUpdates: Record<string, string> = {};
    editableTransactions.forEach((t) => {
      if (t.isSelected && t.editedCategoryId && t.editedCategoryId !== t.categoryId) {
        categoryUpdates[t.compositeKey] = t.editedCategoryId;
      }
    });

    confirmMutation.mutate({ uploadId, selectedKeys, categoryUpdates });
  };

  const toggleTransaction = (index: number) => {
    setEditableTransactions((prev) =>
      prev.map((t, i) => (i === index ? { ...t, isSelected: !t.isSelected } : t))
    );
  };

  const toggleAllTransactions = () => {
    const allSelected = editableTransactions.every((t) => t.isDuplicate || t.isSelected);
    setEditableTransactions((prev) =>
      prev.map((t) => (t.isDuplicate ? t : { ...t, isSelected: !allSelected }))
    );
  };

  const updateCategory = (index: number, categoryId: string) => {
    const category = categories.find((c) => c._id === categoryId);
    setEditableTransactions((prev) =>
      prev.map((t, i) =>
        i === index
          ? { ...t, editedCategoryId: categoryId, editedCategoryName: category?.name }
          : t
      )
    );
  };

  const selectedCount = useMemo(
    () => editableTransactions.filter((t) => t.isSelected && !t.isDuplicate).length,
    [editableTransactions]
  );

  const reset = () => {
    setSelectedSection('');
    setUploadedFile(null);
    setStep('select');
    setEditableTransactions([]);
    setUploadId('');
  };

  const handleClose = () => {
    if (step === 'complete') {
      onSuccess();
    }
    reset();
    onClose();
  };

  const nonDuplicateCount = editableTransactions.filter((t) => !t.isDuplicate).length;
  const allNonDuplicatesSelected = editableTransactions
    .filter((t) => !t.isDuplicate)
    .every((t) => t.isSelected);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={step === 'complete' ? 'Upload Complete' : step === 'preview' ? 'Preview Import' : 'Upload Statement'} 
      size="full"
    >
      {step === 'complete' ? (
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 sm:w-10 sm:h-10 text-green-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Import Complete!</h3>
          <p className="text-gray-400 mb-6">Your transactions have been imported successfully.</p>
          <Button onClick={handleClose}>Done</Button>
        </div>
      ) : step === 'preview' ? (
        <div className="space-y-4">
          {/* Stats - responsive grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-gray-700/50 rounded-lg p-2 sm:p-4 text-center">
              <p className="text-xs sm:text-sm text-gray-400">Total</p>
              <p className="text-lg sm:text-2xl font-bold text-white">{editableTransactions.length}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2 sm:p-4 text-center">
              <p className="text-xs sm:text-sm text-gray-400">Selected</p>
              <p className="text-lg sm:text-2xl font-bold text-green-400">{selectedCount}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-2 sm:p-4 text-center">
              <p className="text-xs sm:text-sm text-gray-400">Duplicates</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-400">{editableTransactions.length - nonDuplicateCount}</p>
            </div>
          </div>

          {/* Select All Button */}
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <button 
              onClick={toggleAllTransactions} 
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {allNonDuplicatesSelected ? <CheckSquare className="w-5 h-5 text-primary-400" /> : <Square className="w-5 h-5" />}
              <span>Select All</span>
            </button>
            <span className="text-xs text-gray-500">{selectedCount} of {nonDuplicateCount} selected</span>
          </div>

          {/* Transactions List - Card based for mobile */}
          <div className="max-h-[50vh] sm:max-h-[400px] overflow-y-auto space-y-2 sm:space-y-0 sm:border sm:border-gray-700 sm:rounded-lg">
            {/* Desktop Table View */}
            <table className="w-full hidden sm:table">
              <thead className="bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-10"></th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase w-40">Category</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {editableTransactions.map((txn, index) => (
                  <tr key={index} className={`${txn.isDuplicate ? 'bg-yellow-900/20 opacity-50' : ''} ${!txn.isSelected && !txn.isDuplicate ? 'opacity-60' : ''} hover:bg-gray-700/30`}>
                    <td className="px-3 py-3">
                      {txn.isDuplicate ? (
                        <AlertCircle className="w-5 h-5 text-yellow-500" title="Duplicate" />
                      ) : (
                        <button onClick={() => toggleTransaction(index)} className="p-1">
                          {txn.isSelected ? <CheckSquare className="w-5 h-5 text-primary-400" /> : <Square className="w-5 h-5 text-gray-500" />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-300 whitespace-nowrap">
                      {formatDate(txn.transactionDate, 'short')}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-200">
                      <span className="block truncate max-w-[300px]" title={txn.description}>{txn.description}</span>
                    </td>
                    <td className="px-3 py-3">
                      {!txn.isDuplicate && (
                        <select
                          value={txn.editedCategoryId || ''}
                          onChange={(e) => updateCategory(index, e.target.value)}
                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-right text-sm font-medium whitespace-nowrap ${txn.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-2">
              {editableTransactions.map((txn, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border ${txn.isDuplicate ? 'bg-yellow-900/20 border-yellow-800 opacity-60' : txn.isSelected ? 'bg-gray-700/50 border-primary-600' : 'bg-gray-800 border-gray-700 opacity-60'}`}
                  onClick={() => !txn.isDuplicate && toggleTransaction(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {txn.isDuplicate ? (
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="flex-shrink-0 mt-0.5">
                          {txn.isSelected ? <CheckSquare className="w-5 h-5 text-primary-400" /> : <Square className="w-5 h-5 text-gray-500" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 break-words">{txn.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{formatDate(txn.transactionDate, 'short')}</span>
                          {txn.isDuplicate && <Badge size="sm" className="bg-yellow-900 text-yellow-400">Duplicate</Badge>}
                        </div>
                      </div>
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${txn.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                      {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </div>
                  {!txn.isDuplicate && (
                    <div className="mt-2 pt-2 border-t border-gray-700" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={txn.editedCategoryId || ''}
                        onChange={(e) => updateCategory(index, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-gray-700">
            <Button variant="secondary" onClick={reset} className="order-2 sm:order-1">Back</Button>
            <Button 
              onClick={handleConfirm} 
              isLoading={confirmMutation.isPending} 
              disabled={selectedCount === 0}
              className="order-1 sm:order-2"
            >
              Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <Select
            label="Select Section"
            options={[
              { value: '', label: 'Choose a section...' },
              ...sections.map((s) => ({ value: s._id, label: s.name })),
            ]}
            value={selectedSection}
            onChange={setSelectedSection}
          />

          {selectedSection && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-600 rounded-lg p-6 sm:p-10 text-center hover:border-primary-400 transition-colors bg-gray-700/30"
            >
              {uploadedFile ? (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-primary-500 mx-auto" />
                  <p className="font-medium text-white text-sm sm:text-base break-all px-2">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                  <Button variant="secondary" size="sm" onClick={() => setUploadedFile(null)}>Remove</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <UploadIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto" />
                  <p className="text-gray-300 text-sm sm:text-base">
                    <span className="hidden sm:inline">Drag and drop your file here, or </span>
                    <label className="text-primary-400 cursor-pointer hover:text-primary-300 font-medium">
                      {window.innerWidth < 640 ? 'Tap to select file' : 'browse'}
                      <input type="file" className="hidden" accept=".csv,.xls,.xlsx,.pdf" onChange={handleFileSelect} />
                    </label>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500">Supports CSV, XLS, XLSX, and PDF files</p>
                </div>
              )}
            </div>
          )}

          {uploadMutation.isError && (
            <div className="p-3 sm:p-4 bg-red-900/30 text-red-400 rounded-lg text-sm border border-red-700">
              {(uploadMutation.error as Error).message || 'Upload failed'}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <Button variant="secondary" onClick={handleClose} className="order-2 sm:order-1">Cancel</Button>
            <Button 
              onClick={handleUpload} 
              isLoading={uploadMutation.isPending} 
              disabled={!uploadedFile || !selectedSection}
              className="order-1 sm:order-2"
            >
              Preview and Upload
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
