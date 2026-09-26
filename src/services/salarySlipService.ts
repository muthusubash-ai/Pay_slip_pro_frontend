import api from './api';
import type { SalarySlip, PaginatedResponse } from '../types';

interface SlipFilters {
  page?: number;
  per_page?: number;
  month?: number;
  year?: number;
  employee_id?: number;
}

export const salarySlipService = {
  // Trailing slash on collection endpoint to avoid FastAPI 307 redirects
  list: (filters: SlipFilters = {}) =>
    api.get<PaginatedResponse<SalarySlip>>('/salary-slips/', { params: filters }),

  get: (id: number) =>
    api.get<SalarySlip>(`/salary-slips/${id}`),

  generateBulk: (month: number, year: number) =>
    api.post('/salary-slips/generate', { month, year }),

  generateSingle: (employeeId: number, month: number, year: number) =>
    api.post<SalarySlip>(`/salary-slips/generate/${employeeId}`, { month, year }),

  downloadPdf: (id: number) =>
    api.get(`/salary-slips/${id}/pdf`, { responseType: 'blob' }),

  emailSlip: (id: number) =>
    api.post(`/salary-slips/${id}/email`),

  delete: (id: number) =>
    api.delete(`/salary-slips/${id}`),
};
