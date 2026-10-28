import api from './api';
import type { DashboardStats, PayrollSummary, DepartmentBreakdown } from '../types';

export const dashboardService = {
  getStats: (company_user_id?: number | null) =>
    api.get<DashboardStats>('/dashboard/stats', { params: { company_user_id: company_user_id || undefined } }),

  getPayrollSummary: (month: number, year: number, company_user_id?: number | null) =>
    api.get<PayrollSummary>('/dashboard/payroll-summary', { params: { month, year, company_user_id: company_user_id || undefined } }),

  getDepartmentBreakdown: (company_user_id?: number | null) =>
    api.get<DepartmentBreakdown[]>('/dashboard/department-breakdown', { params: { company_user_id: company_user_id || undefined } }),
};
