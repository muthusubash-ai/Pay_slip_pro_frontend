import api from './api';
import type { User } from '../types';

interface PlatformStats {
  total_users: number;
  active_users: number;
  total_employees: number;
  total_slips: number;
}

export interface AdminCompanyItem {
  user_id: number;
  user_name: string;
  email: string;
  role: string;
  is_platform_admin: boolean;
  is_active: boolean;
  plan: string;
  company_name: string;
  employee_count: number;
}

export const adminService = {
  listUsers: (page: number = 1, per_page: number = 20) =>
    api.get('/admin/users', { params: { page, per_page } }),

  listCompanies: () =>
    api.get<{ companies: AdminCompanyItem[] }>('/admin/companies'),

  updateUser: (userId: number, data: { role?: string; is_active?: boolean }) =>
    api.put<User>(`/admin/users/${userId}`, data),

  deactivateUser: (userId: number) =>
    api.delete(`/admin/users/${userId}`),

  getStats: () =>
    api.get<PlatformStats>('/admin/stats'),
};
