import api from './api';
import type { Employee, PaginatedResponse } from '../types';

interface EmployeeFilters {
  page?: number;
  per_page?: number;
  search?: string;
  department?: string;
  sort?: string;
  status?: 'active' | 'inactive' | 'all';
}

interface EmployeeCreateData {
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  designation?: string;
  date_of_joining: string;
  bank_account_number?: string;
  bank_name?: string;
  ifsc_code?: string;
  pan_number?: string;
  basic_salary: number;
  hra?: number;
  conveyance_allowance?: number;
  medical_allowance?: number;
  special_allowance?: number;
  pf_deduction?: number;
  professional_tax?: number;
  tds?: number;
  esi?: number;
  /** Optional per-employee shift timing (24-hour "HH:MM"); only used when the company
   * has enabled Company.enable_employee_shift_timing. */
  shift_start_time?: string | null;
  shift_end_time?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  send_invitation?: boolean;
}

export interface IfscDetails {
  ifsc: string;
  bank: string;
  branch: string;
  city: string;
  state: string;
  address: string;
}

export const employeeService = {
  // Trailing slash on collection endpoints to avoid FastAPI 307 redirects
  list: (filters: EmployeeFilters = {}) =>
    api.get<PaginatedResponse<Employee>>('/employees/', { params: filters }),

  get: (id: number) =>
    api.get<Employee>(`/employees/${id}`),

  create: (data: EmployeeCreateData) =>
    api.post<Employee & { email_sent?: boolean }>('/employees/', data),

  sendInvite: (id: number) =>
    api.post<{ detail: string }>(`/employees/${id}/send-invite`),

  update: (id: number, data: Partial<EmployeeCreateData>) =>
    api.put<Employee>(`/employees/${id}`, data),

  delete: (id: number) =>
    api.delete(`/employees/${id}`),

  permanentDelete: (id: number) =>
    api.delete<{ detail: string }>(`/employees/${id}/permanent`),

  reactivate: (id: number, data?: { email?: string }) =>
    api.post<Employee>(`/employees/${id}/reactivate`, data || {}),

  lookupIfsc: (code: string) =>
    api.get<IfscDetails>('/banks/ifsc', { params: { code } }),
};
