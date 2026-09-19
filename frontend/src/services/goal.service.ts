import api from './api';
import {
  ApiResponse,
  CreateGoalPayload,
  GoalDetail,
  GoalListItem,
} from '../types';

export const goalService = {
  async getAll(): Promise<GoalListItem[]> {
    const response = await api.get<ApiResponse<GoalListItem[]>>('/goals');
    return response.data.data;
  },

  async getById(id: string): Promise<GoalDetail> {
    const response = await api.get<ApiResponse<GoalDetail>>(`/goals/${id}`);
    return response.data.data;
  },

  async create(payload: CreateGoalPayload): Promise<GoalListItem> {
    const response = await api.post<ApiResponse<GoalListItem>>('/goals', payload);
    return response.data.data;
  },

  async update(id: string, payload: Partial<CreateGoalPayload>): Promise<GoalListItem> {
    const response = await api.patch<ApiResponse<GoalListItem>>(`/goals/${id}`, payload);
    return response.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/goals/${id}`);
  },
};
