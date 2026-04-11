import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Users, Calendar, Trash2, Eye, Receipt, DollarSign,
} from 'lucide-react';
import { Card, Button, Input, Modal, Badge } from '../components/common';
import { tripService } from '../services/trip.service';

function formatDateWithYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function Trips() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripService.getAll(),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tripService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Trips & Splits</h1>
          <p className="text-sm sm:text-base text-gray-400">Track shared expenses and settle balances</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)} size="sm" className="self-start sm:self-auto">
          Create Trip
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-400">Loading...</div>
        ) : trips.length === 0 ? (
          <Card className="col-span-full text-center py-12">
            <Receipt className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No trips yet. Create one to start tracking shared expenses.</p>
            <Button onClick={() => setShowAddModal(true)}>Create Trip</Button>
          </Card>
        ) : (
          trips.map((trip) => (
            <Card key={trip._id}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">{trip.name}</h3>
                  {trip.description && (
                    <p className="text-sm text-gray-400 mt-1">{trip.description}</p>
                  )}
                </div>
                <Badge
                  variant={
                    trip.status === 'active'
                      ? 'success'
                      : trip.status === 'completed'
                      ? 'info'
                      : 'default'
                  }
                >
                  {trip.status}
                </Badge>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{trip.members.length} members</span>
                </div>
                {trip.startDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDateWithYear(trip.startDate)}
                      {trip.endDate && ` - ${formatDateWithYear(trip.endDate)}`}
                    </span>
                  </div>
                )}
                {trip.defaultCurrency !== 'INR' && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <DollarSign className="w-4 h-4" />
                    <span>1 {trip.defaultCurrency} = ₹{trip.inrRate}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Eye className="w-4 h-4" />}
                  onClick={() => navigate(`/trips/${trip._id}`)}
                >
                  View Details
                </Button>
                <button
                  onClick={() => {
                    if (confirm('Delete this trip?')) {
                      deleteMutation.mutate(trip._id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
      
      <AddTripModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

function AddTripModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultCurrency: 'INR',
    inrRate: '1',
    startDate: '',
    endDate: '',
  });
  
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      tripService.create({
        ...data,
        inrRate: parseFloat(data.inrRate),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      onClose();
      setFormData({
        name: '',
        description: '',
        defaultCurrency: 'INR',
        inrRate: '1',
        startDate: '',
        endDate: '',
      });
    },
  });
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Trip" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate(formData);
        }}
        className="space-y-4"
      >
        <Input
          label="Trip Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Goa Trip 2024"
          required
        />
        
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
        />
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Currency"
            value={formData.defaultCurrency}
            onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value.toUpperCase() })}
            placeholder="INR"
          />
          <Input
            label="Exchange Rate to INR"
            type="number"
            step="0.01"
            value={formData.inrRate}
            onChange={(e) => setFormData({ ...formData, inrRate: e.target.value })}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Create Trip
          </Button>
        </div>
      </form>
    </Modal>
  );
}
