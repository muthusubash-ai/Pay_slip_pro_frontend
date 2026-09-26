import api from './api';
import type { DashboardStats, PayrollSummary, DepartmentBreakdown } from '../types';

export const dashboardService = {
  getStats: () =>
    api.get<DashboardStats>('/dashboard/stats'),

  getPayrollSummary: (month: number, year: number) =>
    api.get<PayrollSummary>('/dashboard/payroll-summary', { params: { month, year } }),

  getDepartmentBreakdown: () =>
    api.get<DepartmentBreakdown[]>('/dashboard/department-breakdown'),
};
