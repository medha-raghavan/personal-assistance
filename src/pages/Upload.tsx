import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, AlertCircle, Tag, Check, Square, CheckSquare } from 'lucide-react';
import { Card, Button, Select, Badge } from '../components/common';
import { sectionService } from '../services/section.service';
import { categoryService } from '../services/category.service';
import { uploadService } from '../services/upload.service';
import { formatCurrency, formatDate } from '../utils/formatters';
import { UploadPreview, ParsedTransaction, Category } from '../types';

interface EditableTransaction extends ParsedTransaction {
  isSelected: boolean;
  editedCategoryId?: string;
  editedCategoryName?: string;
}

export function Upload() {
  const queryClient = useQueryClient();
  const [selectedSection, setSelectedSection] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [editableTransactions, setEditableTransactions] = useState<EditableTransaction[]>([]);
  const [step, setStep] = useState<'select' | 'preview' | 'complete'>('select');
  
  const { data: sections = [] } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });
  
  const uploadableSections = sections.filter((s) => s.uploadEnabled);
  
  const uploadMutation = useMutation({
    mutationFn: ({ file, sectionId }: { file: File; sectionId: string }) =>
      uploadService.uploadStatement(file, sectionId),
    onSuccess: async (data) => {
      const previewData = await uploadService.getPreview(data.uploadId);
      setPreview(previewData);
      setEditableTransactions(
        previewData.transactions.map((txn) => ({
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
    if (file) {
      setUploadedFile(file);
    }
  }, []);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };
  
  const handleUpload = () => {
    if (uploadedFile && selectedSection) {
      uploadMutation.mutate({ file: uploadedFile, sectionId: selectedSection });
    }
  };
  
  const handleConfirm = () => {
    if (preview) {
      const selectedKeys = editableTransactions
        .filter((t) => t.isSelected)
        .map((t) => t.compositeKey);
      
      const categoryUpdates: Record<string, string> = {};
      editableTransactions.forEach((t) => {
        if (t.isSelected && t.editedCategoryId && t.editedCategoryId !== t.categoryId) {
          categoryUpdates[t.compositeKey] = t.editedCategoryId;
        }
      });
      
      confirmMutation.mutate({
        uploadId: preview.uploadId,
        selectedKeys,
        categoryUpdates,
      });
    }
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
    setPreview(null);
    setEditableTransactions([]);
    setStep('select');
  };
  
  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Upload Complete!</h2>
          <p className="text-gray-400 mb-6">
            Your transactions have been imported successfully.
          </p>
          <Button onClick={reset}>Upload Another File</Button>
        </Card>
      </div>
    );
  }
  
  if (step === 'preview' && preview) {
    const nonDuplicateCount = editableTransactions.filter((t) => !t.isDuplicate).length;
    const allNonDuplicatesSelected = editableTransactions
      .filter((t) => !t.isDuplicate)
      .every((t) => t.isSelected);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Preview Import</h1>
            <p className="text-gray-400">{preview.fileName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={confirmMutation.isPending}
              disabled={selectedCount === 0}
            >
              Import {selectedCount} Transactions
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-gray-400">Total Found</p>
            <p className="text-2xl font-bold text-white">{preview.totalCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">Selected to Import</p>
            <p className="text-2xl font-bold text-green-400">{selectedCount}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-400">Duplicates (Auto-skipped)</p>
            <p className="text-2xl font-bold text-yellow-400">{preview.duplicateCount}</p>
          </Card>
        </div>
        
        <Card padding="none">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    <button
                      onClick={toggleAllTransactions}
                      className="flex items-center gap-2 hover:text-white transition-colors"
                    >
                      {allNonDuplicatesSelected ? (
                        <CheckSquare className="w-5 h-5 text-primary-400" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                      Select
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase w-48">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {editableTransactions.map((txn, index) => (
                  <tr
                    key={index}
                    className={`
                      ${txn.isDuplicate ? 'bg-yellow-900/20 opacity-50' : ''}
                      ${!txn.isSelected && !txn.isDuplicate ? 'bg-gray-800/50 opacity-60' : ''}
                      hover:bg-gray-700/30 transition-colors
                    `}
                  >
                    <td className="px-4 py-3">
                      {txn.isDuplicate ? (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-yellow-500" />
                          <span className="text-xs text-yellow-500">Duplicate</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleTransaction(index)}
                          className="flex items-center justify-center"
                        >
                          {txn.isSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatDate(txn.transactionDate, 'short')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      <span className="block truncate max-w-[250px]" title={txn.description}>
                        {txn.description}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {txn.isDuplicate ? (
                        <span className="text-gray-500 text-sm">-</span>
                      ) : (
                        <select
                          value={txn.editedCategoryId || ''}
                          onChange={(e) => updateCategory(index, e.target.value)}
                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          txn.type === 'credit' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {txn.type === 'credit' ? '+' : '-'}
                        {formatCurrency(txn.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        <div className="flex items-center justify-between text-sm text-gray-400">
          <p>
            Tip: Click on a row's checkbox to exclude it from import. Change category using the dropdown.
          </p>
          <p>{selectedCount} of {nonDuplicateCount} transactions selected</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Statement</h1>
        <p className="text-gray-400">Import transactions from your bank statement</p>
      </div>
      
      <Card>
        <div className="space-y-6">
          <Select
            label="Select Section"
            options={[
              { value: '', label: 'Choose a section...' },
              ...uploadableSections.map((s) => ({
                value: s._id,
                label: `${s.name} (${s.parserConfig?.type || 'manual'})`,
              })),
            ]}
            value={selectedSection}
            onChange={setSelectedSection}
          />
          
          {selectedSection && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-primary-400 transition-colors bg-gray-700/30"
            >
              {uploadedFile ? (
                <div className="space-y-2">
                  <FileText className="w-12 h-12 text-primary-500 mx-auto" />
                  <p className="font-medium text-white">{uploadedFile.name}</p>
                  <p className="text-sm text-gray-400">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setUploadedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadIcon className="w-12 h-12 text-gray-500 mx-auto" />
                  <p className="text-gray-300">
                    Drag and drop your file here, or{' '}
                    <label className="text-primary-400 cursor-pointer hover:text-primary-300">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv,.xls,.xlsx,.pdf"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports CSV, XLS, XLSX, and PDF files
                  </p>
                </div>
              )}
            </div>
          )}
          
          {uploadedFile && selectedSection && (
            <Button
              className="w-full"
              onClick={handleUpload}
              isLoading={uploadMutation.isPending}
            >
              Preview and Upload
            </Button>
          )}
          
          {uploadMutation.isError && (
            <div className="p-3 bg-red-900/30 text-red-400 rounded-lg text-sm border border-red-700">
              {(uploadMutation.error as Error).message || 'Upload failed'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
