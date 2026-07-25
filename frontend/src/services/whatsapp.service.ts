import api from './api';
import {
  ApiResponse,
  ScheduledWhatsAppMessage,
  WhatsAppConnectionStatus,
  WhatsAppGroup,
  WhatsAppRecipientType,
} from '../types';

export const whatsappService = {
  async getStatus(): Promise<WhatsAppConnectionStatus> {
    const response = await api.get<ApiResponse<WhatsAppConnectionStatus>>('/whatsapp/status');
    return response.data.data;
  },

  async connect(): Promise<WhatsAppConnectionStatus> {
    const response = await api.post<ApiResponse<WhatsAppConnectionStatus>>('/whatsapp/connect');
    return response.data.data;
  },

  async disconnect(): Promise<WhatsAppConnectionStatus> {
    const response = await api.post<ApiResponse<WhatsAppConnectionStatus>>('/whatsapp/disconnect');
    return response.data.data;
  },

  async getGroups(): Promise<WhatsAppGroup[]> {
    const response = await api.get<ApiResponse<WhatsAppGroup[]>>('/whatsapp/groups');
    return response.data.data;
  },

  async getMessages(status?: string): Promise<ScheduledWhatsAppMessage[]> {
    const response = await api.get<ApiResponse<ScheduledWhatsAppMessage[]>>('/whatsapp/messages', {
      params: status && status !== 'all' ? { status } : undefined,
    });
    return response.data.data;
  },

  async createMessage(data: {
    recipientType?: WhatsAppRecipientType;
    recipientPhone?: string;
    recipientJid?: string;
    recipientName?: string;
    message: string;
    scheduledAt?: string;
    sendNow?: boolean;
  }): Promise<ScheduledWhatsAppMessage> {
    const response = await api.post<ApiResponse<ScheduledWhatsAppMessage>>(
      '/whatsapp/messages',
      data
    );
    return response.data.data;
  },

  async updateMessage(
    id: string,
    data: {
      recipientType?: WhatsAppRecipientType;
      recipientPhone?: string;
      recipientJid?: string;
      recipientName?: string;
      message?: string;
      scheduledAt?: string;
    }
  ): Promise<ScheduledWhatsAppMessage> {
    const response = await api.put<ApiResponse<ScheduledWhatsAppMessage>>(
      `/whatsapp/messages/${id}`,
      data
    );
    return response.data.data;
  },

  async cancelMessage(id: string): Promise<ScheduledWhatsAppMessage> {
    const response = await api.post<ApiResponse<ScheduledWhatsAppMessage>>(
      `/whatsapp/messages/${id}/cancel`
    );
    return response.data.data;
  },

  async deleteMessage(id: string): Promise<void> {
    await api.delete(`/whatsapp/messages/${id}`);
  },
};
