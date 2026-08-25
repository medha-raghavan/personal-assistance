import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  Contact,
  Search,
  Unplug,
  Users,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Card, Button, Input, Modal, Badge, Select } from '../components/common';
import { whatsappService } from '../services/whatsapp.service';
import { googleService } from '../services/google.service';
import {
  GoogleContact,
  ScheduledMessageStatus,
  ScheduledWhatsAppMessage,
  WhatsAppGroup,
  WhatsAppRecipientType,
} from '../types';

function recipientLabel(msg: ScheduledWhatsAppMessage): string {
  if (msg.recipientType === 'group') {
    return msg.recipientName || 'WhatsApp group';
  }
  return msg.recipientName || (msg.recipientPhone ? `+${msg.recipientPhone}` : 'Unknown');
}

function recipientSubLabel(msg: ScheduledWhatsAppMessage): string | null {
  if (msg.recipientType === 'group') {
    return null;
  }
  if (msg.recipientName && msg.recipientPhone) {
    return `+${msg.recipientPhone}`;
  }
  return null;
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCompose, setShowCompose] = useState(false);
  const [editing, setEditing] = useState<ScheduledWhatsAppMessage | null>(null);
  const [googleBanner, setGoogleBanner] = useState<string | null>(null);

  useEffect(() => {
    const google = searchParams.get('google');
    if (!google) return;

    if (google === 'connected') {
      setGoogleBanner('Google Contacts connected');
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
    } else if (google === 'error') {
      setGoogleBanner(
        searchParams.get('message') || 'Failed to connect Google Contacts'
      );
    }

    const next = new URLSearchParams(searchParams);
    next.delete('google');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, queryClient]);

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

  const { data: googleStatus, isLoading: googleLoading } = useQuery({
    queryKey: ['google-status'],
    queryFn: () => googleService.getStatus(),
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

  const googleConnectMutation = useMutation({
    mutationFn: () => googleService.getAuthUrl('/whatsapp'),
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setGoogleBanner(
        err.response?.data?.error?.message || 'Failed to start Google sign-in'
      );
    },
  });

  const googleDisconnectMutation = useMutation({
    mutationFn: () => googleService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-status'] });
      queryClient.removeQueries({ queryKey: ['google-contacts'] });
      setGoogleBanner('Google Contacts disconnected');
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
  const googleConnected = !!googleStatus?.connected;

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

      {googleBanner && (
        <div className="flex items-start justify-between gap-3 text-sm bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-200">
          <span>{googleBanner}</span>
          <button
            type="button"
            className="text-gray-400 hover:text-white"
            onClick={() => setGoogleBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

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
                <h2 className="font-semibold text-white">WhatsApp connection</h2>
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
            ) : connection?.status === 'connecting' ? (
              <div className="text-center py-8 px-4 text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-40 animate-pulse" />
                <p className="text-sm">Connecting… QR will appear shortly</p>
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

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                googleConnected ? 'bg-blue-900/40 text-blue-300' : 'bg-gray-700 text-gray-300'
              }`}
            >
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white">Google Contacts</h2>
              <p className="text-sm text-gray-400">
                {googleLoading
                  ? 'Checking status...'
                  : !googleStatus?.configured
                    ? 'Not configured on server (set GOOGLE_CLIENT_ID / SECRET)'
                    : googleConnected
                      ? `Connected${googleStatus.email ? ` as ${googleStatus.email}` : ''}`
                      : 'Connect to pick recipients from your contacts'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {googleStatus?.configured && !googleConnected && (
              <Button
                leftIcon={<Contact className="w-4 h-4" />}
                onClick={() => googleConnectMutation.mutate()}
                isLoading={googleConnectMutation.isPending}
              >
                Connect Google
              </Button>
            )}
            {googleConnected && (
              <Button
                variant="secondary"
                leftIcon={<Unplug className="w-4 h-4" />}
                onClick={() => {
                  if (confirm('Disconnect Google Contacts?')) {
                    googleDisconnectMutation.mutate();
                  }
                }}
                isLoading={googleDisconnectMutation.isPending}
              >
                Disconnect Google
              </Button>
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
                    {msg.recipientType === 'group' && (
                      <Badge variant="default">Group</Badge>
                    )}
                    <span className="font-medium text-white">{recipientLabel(msg)}</span>
                    {recipientSubLabel(msg) && (
                      <span className="text-sm text-gray-400">{recipientSubLabel(msg)}</span>
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
        googleConnected={googleConnected}
        onConnectGoogle={() => googleConnectMutation.mutate()}
        connectingGoogle={googleConnectMutation.isPending}
      />
    </div>
  );
}

function ComposeModal({
  isOpen,
  onClose,
  message,
  isConnected,
  googleConnected,
  onConnectGoogle,
  connectingGoogle,
}: {
  isOpen: boolean;
  onClose: () => void;
  message: ScheduledWhatsAppMessage | null;
  isConnected: boolean;
  googleConnected: boolean;
  onConnectGoogle: () => void;
  connectingGoogle: boolean;
}) {
  const queryClient = useQueryClient();
  const [recipientType, setRecipientType] = useState<WhatsAppRecipientType>('contact');
  const [formData, setFormData] = useState({
    recipientPhone: '',
    recipientJid: '',
    recipientName: '',
    message: '',
    scheduledAt: defaultScheduleValue(),
  });
  const [sendMode, setSendMode] = useState<'schedule' | 'now'>('schedule');
  const [formError, setFormError] = useState<string | null>(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showGroups, setShowGroups] = useState(false);

  useEffect(() => {
    if (message) {
      const type: WhatsAppRecipientType =
        message.recipientType === 'group' ? 'group' : 'contact';
      setRecipientType(type);
      setFormData({
        recipientPhone: message.recipientPhone || '',
        recipientJid: message.recipientJid || '',
        recipientName: message.recipientName || '',
        message: message.message,
        scheduledAt: toLocalDateTimeValue(parseISO(message.scheduledAt)),
      });
      setSendMode('schedule');
    } else {
      setRecipientType('contact');
      setFormData({
        recipientPhone: '',
        recipientJid: '',
        recipientName: '',
        message: '',
        scheduledAt: defaultScheduleValue(),
      });
      setSendMode('schedule');
    }
    setFormError(null);
    setShowContacts(false);
    setShowGroups(false);
  }, [message, isOpen]);

  type MessagePayload = {
    recipientType: WhatsAppRecipientType;
    recipientPhone?: string;
    recipientJid?: string;
    recipientName?: string;
    message: string;
    scheduledAt?: string;
    sendNow?: boolean;
  };

  const createMutation = useMutation({
    mutationFn: (payload: MessagePayload) => whatsappService.createMessage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setFormError(err.response?.data?.error?.message || 'Failed to create message');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: MessagePayload) =>
      whatsappService.updateMessage(message!._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      setFormError(err.response?.data?.error?.message || 'Failed to update message');
    },
  });

  const buildPayload = (opts: { sendNow?: boolean; scheduledAt?: string }): MessagePayload | null => {
    if (!formData.message.trim()) {
      setFormError('Message cannot be empty');
      return null;
    }

    if (recipientType === 'group') {
      if (!formData.recipientJid.trim()) {
        setFormError('Pick a WhatsApp group');
        return null;
      }
      return {
        recipientType: 'group',
        recipientJid: formData.recipientJid.trim(),
        recipientName: formData.recipientName.trim() || undefined,
        message: formData.message.trim(),
        ...opts,
      };
    }

    if (!formData.recipientPhone.trim()) {
      setFormError('Phone number and message are required');
      return null;
    }

    return {
      recipientType: 'contact',
      recipientPhone: formData.recipientPhone.trim(),
      recipientName: formData.recipientName.trim() || undefined,
      message: formData.message.trim(),
      ...opts,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (message) {
      const payload = buildPayload({
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
      });
      if (payload) updateMutation.mutate(payload);
      return;
    }

    if (sendMode === 'now') {
      if (!isConnected) {
        setFormError('Connect WhatsApp before sending now');
        return;
      }
      const payload = buildPayload({ sendNow: true });
      if (payload) createMutation.mutate(payload);
    } else {
      const payload = buildPayload({
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
      });
      if (payload) createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={message ? 'Edit scheduled message' : 'Schedule WhatsApp message'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setRecipientType('contact');
                setFormData((prev) => ({
                  ...prev,
                  recipientJid: '',
                  recipientName: prev.recipientPhone ? prev.recipientName : '',
                }));
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                recipientType === 'contact'
                  ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                  : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => {
                setRecipientType('group');
                setFormData((prev) => ({
                  ...prev,
                  recipientPhone: '',
                }));
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                recipientType === 'group'
                  ? 'border-primary-500 bg-primary-600/20 text-primary-300'
                  : 'border-gray-600 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Group
            </button>
          </div>

          {recipientType === 'contact' ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Phone number (with country code)"
                    value={formData.recipientPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, recipientPhone: e.target.value })
                    }
                    placeholder="e.g. 919876543210"
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Contact className="w-4 h-4" />}
                  onClick={() => {
                    if (!googleConnected) {
                      onConnectGoogle();
                      return;
                    }
                    setShowContacts(true);
                  }}
                  isLoading={connectingGoogle}
                  className="mb-0"
                >
                  Contacts
                </Button>
              </div>

              <Input
                label="Recipient name (optional)"
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                placeholder="e.g. Mom"
              />
            </>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">WhatsApp group</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 truncate">
                  {formData.recipientJid
                    ? formData.recipientName || formData.recipientJid
                    : 'No group selected'}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<Users className="w-4 h-4" />}
                  onClick={() => {
                    if (!isConnected) {
                      setFormError('Connect WhatsApp to pick a group');
                      return;
                    }
                    setShowGroups(true);
                  }}
                >
                  Pick group
                </Button>
              </div>
            </div>
          )}

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

      <ContactPickerModal
        isOpen={showContacts}
        onClose={() => setShowContacts(false)}
        onSelect={(contact, phone) => {
          setFormData((prev) => ({
            ...prev,
            recipientPhone: phone.phone,
            recipientName: contact.name,
            recipientJid: '',
          }));
          setRecipientType('contact');
          setShowContacts(false);
        }}
      />

      <GroupPickerModal
        isOpen={showGroups}
        onClose={() => setShowGroups(false)}
        onSelect={(group) => {
          setFormData((prev) => ({
            ...prev,
            recipientJid: group.id,
            recipientName: group.name,
            recipientPhone: '',
          }));
          setRecipientType('group');
          setShowGroups(false);
        }}
      />
    </>
  );
}

function ContactPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (contact: GoogleContact, phone: GoogleContact['phones'][0]) => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search, isOpen]);

  const { data: contacts = [], isLoading, isFetching, error } = useQuery({
    queryKey: ['google-contacts', debouncedSearch],
    queryFn: () => googleService.getContacts(debouncedSearch || undefined),
    enabled: isOpen,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pick a Google contact" size="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
            {(error as { response?: { data?: { error?: { message?: string } } } }).response?.data
              ?.error?.message || 'Failed to load contacts'}
          </div>
        )}

        <div className="max-h-96 overflow-y-auto space-y-2">
          {isLoading || isFetching ? (
            <p className="text-center text-gray-400 py-8">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No contacts with phone numbers found.
            </p>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.resourceName || `${contact.name}-${contact.phones[0]?.phone}`}
                className="rounded-lg border border-gray-700 bg-gray-800/60 p-3"
              >
                <div className="flex items-center gap-3 mb-2">
                  {contact.photoUrl ? (
                    <img
                      src={contact.photoUrl}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary-600/30 text-primary-300 flex items-center justify-center font-medium">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{contact.name}</p>
                    {contact.email && (
                      <p className="text-xs text-gray-400 truncate">{contact.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 pl-12">
                  {contact.phones.map((phone) => (
                    <button
                      key={`${contact.resourceName}-${phone.phone}`}
                      type="button"
                      onClick={() => onSelect(contact, phone)}
                      className="text-left px-3 py-2 rounded-lg bg-gray-900/70 hover:bg-primary-600/20 border border-gray-700 hover:border-primary-500 transition-colors"
                    >
                      <span className="text-sm text-white">+{phone.phone}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {phone.label || phone.displayPhone}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function GroupPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (group: WhatsAppGroup) => void;
}) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const { data: groups = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: () => whatsappService.getGroups(),
    enabled: isOpen,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pick a WhatsApp group" size="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3 flex items-center justify-between gap-3">
            <span>
              {(error as { response?: { data?: { error?: { message?: string } } } }).response?.data
                ?.error?.message || 'Failed to load groups'}
            </span>
            <Button type="button" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto space-y-2">
          {isLoading || isFetching ? (
            <p className="text-center text-gray-400 py-8">Loading groups...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No groups found.</p>
          ) : (
            filtered.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelect(group)}
                className="w-full text-left flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/60 p-3 hover:bg-primary-600/20 hover:border-primary-500 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary-600/30 text-primary-300 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{group.name}</p>
                  <p className="text-xs text-gray-400">
                    {group.participantCount} participant
                    {group.participantCount === 1 ? '' : 's'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
