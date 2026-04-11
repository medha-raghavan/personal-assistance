import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Upload, CreditCard, Wallet, Building2, PiggyBank, Landmark, Smartphone } from 'lucide-react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/common';
import { sectionService } from '../services/section.service';
import { formatCurrency } from '../utils/formatters';
import { Section } from '../types';

const SECTION_TYPES = [
  { value: 'checking', label: 'Bank Account (Checking)', icon: Building2, color: 'text-blue-400' },
  { value: 'savings', label: 'Bank Account (Savings)', icon: PiggyBank, color: 'text-green-400' },
  { value: 'credit', label: 'Credit Card', icon: CreditCard, color: 'text-red-400' },
  { value: 'cash', label: 'Cash / Wallet', icon: Wallet, color: 'text-yellow-400' },
  { value: 'investment', label: 'Investment', icon: Landmark, color: 'text-purple-400' },
  { value: 'digital_wallet', label: 'Digital Wallet (PayTM, GPay)', icon: Smartphone, color: 'text-cyan-400' },
];

export function Sections() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionService.getAll(),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => sectionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });
  
  const getSectionTypeInfo = (type: string) => {
    return SECTION_TYPES.find(t => t.value === type) || SECTION_TYPES[0];
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Sections</h1>
          <p className="text-sm sm:text-base text-gray-400">Manage your financial accounts</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)} size="sm" className="self-start sm:self-auto">
          Add Section
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Loading...</div>
        ) : sections.length === 0 ? (
          <Card className="col-span-full text-center py-12">
            <p className="text-gray-400 mb-4">No sections yet. Create your first section to start tracking.</p>
            <Button onClick={() => setShowAddModal(true)}>Create Section</Button>
          </Card>
        ) : (
          sections.map((section) => {
            const typeInfo = getSectionTypeInfo(section.type);
            const IconComponent = typeInfo.icon;
            return (
              <Card key={section._id}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 bg-gray-700 rounded-lg ${typeInfo.color}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{section.name}</h3>
                      <p className="text-sm text-gray-400">{section.label}</p>
                    </div>
                  </div>
                  <Badge variant={section.type === 'credit' ? 'danger' : 'success'}>
                    {typeInfo.label.split('(')[0].trim()}
                  </Badge>
                </div>
                
                <div className="mt-4">
                  <p className={`text-2xl font-bold ${section.type === 'credit' && section.balance > 0 ? 'text-red-400' : 'text-white'}`}>
                    {section.type === 'credit' && section.balance > 0 ? '-' : ''}
                    {formatCurrency(Math.abs(section.balance))}
                  </p>
                  <p className="text-sm text-gray-400">Current Balance</p>
                </div>
                
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-700">
                  <div className="flex items-center gap-2">
                    {section.uploadEnabled && (
                      <Badge variant="info" size="sm">
                        <Upload className="w-3 h-3 mr-1" />
                        {section.parserConfig?.type || 'manual'}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSection(section)}
                      className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this section? This cannot be undone.')) {
                          deleteMutation.mutate(section._id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
      
      <SectionModal
        isOpen={showAddModal || !!editingSection}
        onClose={() => {
          setShowAddModal(false);
          setEditingSection(null);
        }}
        section={editingSection}
      />
    </div>
  );
}

function SectionModal({
  isOpen,
  onClose,
  section,
}: {
  isOpen: boolean;
  onClose: () => void;
  section: Section | null;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: section?.name || '',
    label: section?.label || '',
    type: section?.type || 'checking',
    balance: section?.balance?.toString() || '0',
    uploadEnabled: section?.uploadEnabled ?? true,
    parserType: section?.parserConfig?.type || 'manual',
  });
  
  React.useEffect(() => {
    if (section) {
      setFormData({
        name: section.name,
        label: section.label,
        type: section.type,
        balance: section.balance.toString(),
        uploadEnabled: section.uploadEnabled,
        parserType: section.parserConfig?.type || 'manual',
      });
    } else {
      setFormData({
        name: '',
        label: '',
        type: 'checking',
        balance: '0',
        uploadEnabled: true,
        parserType: 'manual',
      });
    }
  }, [section]);
  
  const createMutation = useMutation({
    mutationFn: (data: Partial<Section>) => sectionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      onClose();
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Section> }) =>
      sectionService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      onClose();
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      label: formData.label,
      type: formData.type as Section['type'],
      balance: parseFloat(formData.balance),
      uploadEnabled: formData.uploadEnabled,
      parserConfig: { type: formData.parserType as Section['parserConfig']['type'] },
    };
    
    if (section) {
      updateMutation.mutate({ id: section._id, data });
    } else {
      createMutation.mutate(data);
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={section ? 'Edit Section' : 'Add Section'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., HDFC Savings"
          required
        />
        
        <Input
          label="Label / Description"
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          placeholder="e.g., Primary Savings Account"
        />
        
        <Select
          label="Account Type"
          options={SECTION_TYPES.map(t => ({ value: t.value, label: t.label }))}
          value={formData.type}
          onChange={(value) => setFormData({ ...formData, type: value })}
        />
        
        <Input
          label="Initial Balance"
          type="number"
          step="0.01"
          value={formData.balance}
          onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
        />
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="uploadEnabled"
            checked={formData.uploadEnabled}
            onChange={(e) => setFormData({ ...formData, uploadEnabled: e.target.checked })}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="uploadEnabled" className="text-gray-300">Enable statement upload</label>
        </div>
        
        {formData.uploadEnabled && (
          <Select
            label="Parser Type"
            options={[
              { value: 'manual', label: 'Manual Entry Only' },
              { value: 'hdfc_csv', label: 'HDFC CSV' },
              { value: 'icici_pdf', label: 'ICICI PDF' },
              { value: 'generic_xls', label: 'Generic Excel' },
            ]}
            value={formData.parserType}
            onChange={(value) => setFormData({ ...formData, parserType: value })}
          />
        )}
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {section ? 'Update' : 'Create'} Section
          </Button>
        </div>
      </form>
    </Modal>
  );
}
