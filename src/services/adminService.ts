import api from './api';
import type { User } from '../types';

interface PlatformStats {
  total_users: number;
  active_users: number;
  total_employees: number;
  total_slips: number;
}

export const adminService = {
  listUsers: (page: number = 1, per_page: number = 20) =>
    api.get('/admin/users', { params: { page, per_page } }),

  updateUser: (userId: number, data: { role?: string; is_active?: boolean }) =>
    api.put<User>(`/admin/users/${userId}`, data),

  deactivateUser: (userId: number) =>
    api.delete(`/admin/users/${userId}`),

  getStats: () =>
    api.get<PlatformStats>('/admin/stats'),
};
