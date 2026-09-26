import api from './api';
import type { User } from '../types';

export const authService = {
  register: (email: string, password: string, full_name: string) =>
    api.post<User>('/auth/register', { email, password, full_name }),

  login: (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    return api.post('/auth/login', form);
  },

  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),

  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),

  getMe: () => api.get<User>('/auth/me'),

  updateProfile: (data: { full_name?: string }) =>
    api.put<User>('/auth/me', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
};
