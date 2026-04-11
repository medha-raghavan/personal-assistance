import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Tag, Search } from 'lucide-react';
import { Card, Button, Input, Modal, Badge } from '../components/common';
import { categoryService } from '../services/category.service';
import { Category } from '../types';

export function Categories() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newKeyword, setNewKeyword] = useState<{ categoryId: string; value: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getAll(),
  });

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase().trim();
    return categories.filter((category: Category) => {
      const nameMatch = category.name.toLowerCase().includes(query);
      const keywordMatch = category.keywords.some((keyword: string) =>
        keyword.toLowerCase().includes(query)
      );
      return nameMatch || keywordMatch;
    });
  }, [categories, searchQuery]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const addKeywordMutation = useMutation({
    mutationFn: ({ id, keyword }: { id: string; keyword: string }) =>
      categoryService.addKeyword(id, keyword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewKeyword(null);
    },
  });

  const removeKeywordMutation = useMutation({
    mutationFn: ({ id, keyword }: { id: string; keyword: string }) =>
      categoryService.removeKeyword(id, keyword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Categories</h1>
          <p className="text-sm sm:text-base text-gray-400">Manage categories and auto-tagging keywords</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)} size="sm" className="self-start sm:self-auto">
          Add Category
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by category name or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Loading...</div>
        ) : filteredCategories.length === 0 ? (
          <Card className="col-span-full text-center py-12">
            <p className="text-gray-400 mb-4">
              {searchQuery ? 'No categories match your search.' : 'No categories yet.'}
            </p>
            {!searchQuery && <Button onClick={() => setShowAddModal(true)}>Create Category</Button>}
          </Card>
        ) : (
          filteredCategories.map((category) => (
            <Card key={category._id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color || '#6b7280' }}
                  >
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{category.name}</h3>
                    <p className="text-sm text-gray-400">
                      {category.keywords.length} keywords
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!category.isDefault && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this category?')) {
                          deleteMutation.mutate(category._id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {category.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-sm text-gray-300"
                    >
                      {keyword}
                      <button
                        onClick={() =>
                          removeKeywordMutation.mutate({ id: category._id, keyword })
                        }
                        className="text-gray-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {category.keywords.length === 0 && (
                    <span className="text-gray-500 text-sm">No keywords</span>
                  )}
                </div>

                {newKeyword?.categoryId === category._id ? (
                  <div className="flex gap-2">
                    <Input
                      value={newKeyword.value}
                      onChange={(e) =>
                        setNewKeyword({ ...newKeyword, value: e.target.value })
                      }
                      placeholder="Enter keyword..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newKeyword.value.trim()) {
                          addKeywordMutation.mutate({
                            id: category._id,
                            keyword: newKeyword.value.trim(),
                          });
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (newKeyword.value.trim()) {
                          addKeywordMutation.mutate({
                            id: category._id,
                            keyword: newKeyword.value.trim(),
                          });
                        }
                      }}
                      isLoading={addKeywordMutation.isPending}
                    >
                      Add
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewKeyword(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setNewKeyword({ categoryId: category._id, value: '' })}
                  >
                    Add Keyword
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <CategoryModal
        isOpen={showAddModal || !!editingCategory}
        onClose={() => {
          setShowAddModal(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
      />
    </div>
  );
}

function CategoryModal({
  isOpen,
  onClose,
  category,
}: {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color: category?.color || '#6b7280',
  });

  React.useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        color: category.color || '#6b7280',
      });
    } else {
      setFormData({
        name: '',
        color: '#6b7280',
      });
    }
  }, [category]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => categoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      categoryService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category) {
      updateMutation.mutate({ id: category._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const colorOptions = [
    '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Edit Category' : 'Add Category'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Category Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Food & Dining"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full transition-transform ${
                  formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setFormData({ ...formData, color })}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {category ? 'Update' : 'Create'} Category
          </Button>
        </div>
      </form>
    </Modal>
  );
}
