import api from './api';
import type { User } from '../types';

export const authService = {
  register: (email: string, password: string, full_name: string, phone?: string) =>
    api.post<User>('/auth/register', { email, password, full_name, phone }),

  login: (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    return api.post('/auth/login', form);
  },

  refresh: () => api.post('/auth/refresh', {}),

  logout: () => api.post('/auth/logout', {}),

  getMe: () => api.get<User>('/auth/me'),

  updateProfile: (data: { full_name?: string; phone?: string; company_name?: string }) =>
    api.put<User>('/auth/me', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
};
