import api from './api';
import { UploadPreview, ApiResponse } from '../types';

export const uploadService = {
  async uploadStatement(
    file: File,
    sectionId: string
  ): Promise<{
    uploadId: string;
    fileName: string;
    totalCount: number;
    duplicateCount: number;
    newCount: number;
    parseErrors: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sectionId', sectionId);

    const response = await api.post('/upload/statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async getPreview(uploadId: string): Promise<UploadPreview> {
    const response = await api.get<ApiResponse<UploadPreview>>(`/upload/preview/${uploadId}`);
    return response.data.data;
  },

  async confirmUpload(
    uploadId: string,
    options: {
      skipDuplicates?: boolean;
      selectedTransactions?: string[];
      categoryUpdates?: Record<string, string>;
    } = {}
  ): Promise<{
    importedCount: number;
    skippedDuplicates: number;
    newBalance: number;
  }> {
    const response = await api.post(`/upload/confirm/${uploadId}`, options);
    return response.data.data;
  },

  async cancelUpload(uploadId: string): Promise<void> {
    await api.delete(`/upload/cancel/${uploadId}`);
  },
};
