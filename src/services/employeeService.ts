import api from './api';
import type { Employee, PaginatedResponse } from '../types';

interface EmployeeFilters {
  page?: number;
  per_page?: number;
  search?: string;
  department?: string;
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
}

export const employeeService = {
  // Trailing slash on collection endpoints to avoid FastAPI 307 redirects
  list: (filters: EmployeeFilters = {}) =>
    api.get<PaginatedResponse<Employee>>('/employees/', { params: filters }),

  get: (id: number) =>
    api.get<Employee>(`/employees/${id}`),

  create: (data: EmployeeCreateData) =>
    api.post<Employee>('/employees/', data),

  update: (id: number, data: Partial<EmployeeCreateData>) =>
    api.put<Employee>(`/employees/${id}`, data),

  delete: (id: number) =>
    api.delete(`/employees/${id}`),
};
