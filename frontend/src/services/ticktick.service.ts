import api from './api';
import {
  ApiResponse,
  TickTickConnectionStatus,
  TickTickWeekDashboard,
  TickTickWeekTask,
} from '../types';

export const ticktickService = {
  async getStatus(): Promise<TickTickConnectionStatus> {
    const response = await api.get<ApiResponse<TickTickConnectionStatus>>('/ticktick/status');
    return response.data.data;
  },

  async getAuthUrl(returnTo = '/'): Promise<string> {
    const response = await api.get<ApiResponse<{ url: string }>>('/ticktick/auth-url', {
      params: { returnTo },
    });
    return response.data.data.url;
  },

  async disconnect(): Promise<TickTickConnectionStatus> {
    const response = await api.post<ApiResponse<TickTickConnectionStatus>>('/ticktick/disconnect');
    return response.data.data;
  },

  async getWeekDashboard(): Promise<TickTickWeekDashboard> {
    const response = await api.get<ApiResponse<TickTickWeekDashboard>>('/ticktick/week-dashboard');
    return response.data.data;
  },

  async completeTask(projectId: string, taskId: string): Promise<void> {
    await api.post(`/ticktick/tasks/${encodeURIComponent(projectId)}/${encodeURIComponent(taskId)}/complete`);
  },

  async createNote(title: string): Promise<TickTickWeekTask> {
    const response = await api.post<ApiResponse<TickTickWeekTask>>('/ticktick/notes', { title });
    return response.data.data;
  },

  async updateNote(projectId: string, taskId: string, title: string): Promise<TickTickWeekTask> {
    const response = await api.put<ApiResponse<TickTickWeekTask>>(
      `/ticktick/notes/${encodeURIComponent(projectId)}/${encodeURIComponent(taskId)}`,
      { title }
    );
    return response.data.data;
  },
};
