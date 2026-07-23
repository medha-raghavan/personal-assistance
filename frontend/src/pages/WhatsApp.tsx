import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle,
  Plus,
  QrCode,
  Send,
  Trash2,
  XCircle,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Card, Button, Input, Modal, Badge, Select } from '../components/common';
import { whatsappService } from '../services/whatsapp.service';
import { ScheduledMessageStatus, ScheduledWhatsAppMessage } from '../types';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusBadgeVariant(
  status: ScheduledMessageStatus
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'sent':
      return 'success';
    case 'pending':
    case 'sending':
      return 'info';
    case 'failed':
      return 'danger';
    case 'cancelled':
      return 'warning';
    default:
      return 'default';
  }
}

function toLocalDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return toLocalDateTimeValue(d);
}

export function WhatsApp() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompose, setShowCompose] = useState(false);
  const [editing, setEditing] = useState<ScheduledWhatsAppMessage | null>(null);

  const {
    data: connection,
    isLoading: connectionLoading,
  } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappService.getStatus(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'qr' || status === 'connecting' ? 2000 : 10000;
    },
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['whatsapp-messages', statusFilter],
    queryFn: () => whatsappService.getMessages(statusFilter),
    refetchInterval: 15000,
  });

  const connectMutation = useMutation({
    mutationFn: () => whatsappService.connect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => whatsappService.cancelMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => whatsappService.deleteMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    },
  });

  const isConnected = connection?.status === 'connected';
  const showQr = connection?.status === 'qr' && connection.qrDataUrl;

  const pendingCount = useMemo(
    () => messages.filter((m) => m.status === 'pending').length,
    [messages]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">WhatsApp</h1>
          <p className="text-sm sm:text-base text-gray-400">
            Connect your personal WhatsApp and schedule messages
          </p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditing(null);
            setShowCompose(true);
          }}
          size="sm"
          className="self-start sm:self-auto"
          disabled={!isConnected}
          title={!isConnected ? 'Connect WhatsApp first' : undefined}
        >
          Schedule Message
        </Button>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  isConnected ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-300'
                }`}
              >
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-semibold text-white">Account connection</h2>
                <p className="text-sm text-gray-400">
                  {connectionLoading
                    ? 'Checking status...'
                    : isConnected
                      ? `Connected${connection?.phoneNumber ? ` as +${connection.phoneNumber}` : ''}`
                      : connection?.status === 'qr'
                        ? 'Scan the QR code with WhatsApp on your phone'
                        : connection?.status === 'connecting'
                          ? 'Connecting...'
                          : connection?.hasSavedSession
                            ? 'Session saved — reconnect to resume'
                            : 'Not connected'}
                </p>
              </div>
            </div>

            {connection?.lastError && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{connection.lastError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!isConnected && (
                <Button
                  leftIcon={<QrCode className="w-4 h-4" />}
                  onClick={() => connectMutation.mutate()}
                  isLoading={connectMutation.isPending || connection?.status === 'connecting'}
                >
                  {connection?.hasSavedSession ? 'Reconnect' : 'Connect WhatsApp'}
                </Button>
              )}
              {(isConnected || connection?.hasSavedSession || connection?.status === 'qr') && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm('Disconnect and clear the saved WhatsApp session?')) {
                      disconnectMutation.mutate();
                    }
                  }}
                  isLoading={disconnectMutation.isPending}
                >
                  Disconnect
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Open WhatsApp → Linked devices → Link a device, then scan the QR code. Uses an
              unofficial multi-device connection — keep this server private.
            </p>
          </div>

          <div className="flex items-center justify-center lg:w-72">
            {showQr ? (
              <div className="bg-white p-3 rounded-xl">
                <img
                  src={connection.qrDataUrl!}
                  alt="WhatsApp QR code"
                  className="w-56 h-56"
                />
              </div>
            ) : isConnected ? (
              <div className="text-center py-8 px-4">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Ready to send</p>
                {pendingCount > 0 && (
                  <p className="text-sm text-gray-400 mt-1">
                    {pendingCount} pending message{pendingCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 px-4 text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">QR code will appear here</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Scheduled messages</h2>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={STATUS_FILTERS}
          />
        </div>
      </div>

      {messagesLoading ? (
        <Card>
          <p className="text-center py-10 text-gray-400">Loading messages...</p>
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No messages yet.</p>
            <Button
              onClick={() => {
                setEditing(null);
                setShowCompose(true);
              }}
              disabled={!isConnected}
            >
              Schedule your first message
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg._id}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusBadgeVariant(msg.status)}>{msg.status}</Badge>
                    <span className="font-medium text-white">
                      {msg.recipientName || `+${msg.recipientPhone}`}
                    </span>
                    {msg.recipientName && (
                      <span className="text-sm text-gray-400">+{msg.recipientPhone}</span>
                    )}
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap break-words">{msg.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      Scheduled{' '}
                      {format(parseISO(msg.scheduledAt), 'MMM d, yyyy h:mm a')} (
                      {formatDistanceToNow(parseISO(msg.scheduledAt), { addSuffix: true })})
                    </span>
                    {msg.sentAt && (
                      <span>Sent {format(parseISO(msg.sentAt), 'MMM d, yyyy h:mm a')}</span>
                    )}
                  </div>
                  {msg.error && (
                    <p className="text-sm text-red-400 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {msg.error}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {msg.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(msg);
                          setShowCompose(true);
                        }}
                        className="p-2 text-gray-400 hover:text-primary-400 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Cancel this scheduled message?')) {
                            cancelMutation.mutate(msg._id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {msg.status !== 'sending' && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this message?')) {
                          deleteMutation.mutate(msg._id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ComposeModal
        isOpen={showCompose}
        onClose={() => {
          setShowCompose(false);
          setEditing(null);
        }}
        message={editing}
        isConnected={!!isConnected}
      />
    </div>
  );
}

function ComposeModal({
  isOpen,
  onClose,
  message,
  isConnected,
}: {
  isOpen: boolean;
  onClose: () => void;
  message: ScheduledWhatsAppMessage | null;
  isConnected: boolean;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    recipientPhone: '',
    recipientName: '',
    message: '',
    scheduledAt: defaultScheduleValue(),
  });
  const [sendMode, setSendMode] = useState<'schedule' | 'now'>('schedule');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setFormData({
        recipientPhone: message.recipientPhone,
        recipientName: message.recipientName || '',
        message: message.message,
        scheduledAt: toLocalDateTimeValue(parseISO(message.scheduledAt)),
      });
      setSendMode('schedule');
    } else {
      setFormData({
        recipientPhone: '',
        recipientName: '',
        message: '',
        scheduledAt: defaultScheduleValue(),
      });
      setSendMode('schedule');
    }
    setFormError(null);
  }, [message, isOpen]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      recipientPhone: string;
      recipientName?: string;
      message: string;
      scheduledAt?: string;
      sendNow?: boolean;
    }) => whatsappService.createMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setFormError(err.response?.data?.error?.message || 'Failed to create message');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      recipientPhone: string;
      recipientName?: string;
      message: string;
      scheduledAt: string;
    }) => whatsappService.updateMessage(message!._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setFormError(err.response?.data?.error?.message || 'Failed to update message');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.recipientPhone.trim() || !formData.message.trim()) {
      setFormError('Phone number and message are required');
      return;
    }

    if (message) {
      updateMutation.mutate({
        recipientPhone: formData.recipientPhone.trim(),
        recipientName: formData.recipientName.trim() || undefined,
        message: formData.message.trim(),
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
      });
      return;
    }

    if (sendMode === 'now') {
      if (!isConnected) {
        setFormError('Connect WhatsApp before sending now');
        return;
      }
      createMutation.mutate({
        recipientPhone: formData.recipientPhone.trim(),
        recipientName: formData.recipientName.trim() || undefined,
        message: formData.message.trim(),
        sendNow: true,
      });
    } else {
      createMutation.mutate({
        recipientPhone: formData.recipientPhone.trim(),
        recipientName: formData.recipientName.trim() || undefined,
        message: formData.message.trim(),
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={message ? 'Edit scheduled message' : 'Schedule WhatsApp message'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Phone number (with country code)"
          value={formData.recipientPhone}
          onChange={(e) => setFormData({ ...formData, recipientPhone: e.target.value })}
          placeholder="e.g. 919876543210"
          required
        />

        <Input
          label="Recipient name (optional)"
          value={formData.recipientName}
          onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
          placeholder="e.g. Mom"
        />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Message</label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            rows={5}
            maxLength={4096}
            required
            placeholder="Type your WhatsApp message..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
          />
          <p className="mt-1 text-xs text-gray-500 text-right">
            {formData.message.length}/4096
          </p>
        </div>

        {!message && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSendMode('schedule')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sendMode === 'schedule'
                  ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                  : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Schedule for later
            </button>
            <button
              type="button"
              onClick={() => setSendMode('now')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sendMode === 'now'
                  ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                  : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Send now
            </button>
          </div>
        )}

        {(message || sendMode === 'schedule') && (
          <Input
            label="Send at"
            type="datetime-local"
            value={formData.scheduledAt}
            onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
            required
          />
        )}

        {formError && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
            {formError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            leftIcon={
              !message && sendMode === 'now' ? <Send className="w-4 h-4" /> : undefined
            }
          >
            {message
              ? 'Update'
              : sendMode === 'now'
                ? 'Send now'
                : 'Schedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
