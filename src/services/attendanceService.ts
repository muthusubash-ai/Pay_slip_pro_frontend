import api from './api';
import type { AttendanceRecord, EmployeeLeaveSummary } from '../types';

export const attendanceService = {
  markAttendance: (data: { employee_id: number; date: string; status: string }) =>
    api.post<AttendanceRecord>('/attendance/', data),

  bulkMarkLeaves: (data: {
    employee_id: number;
    month: number;
    year: number;
    leave_dates: string[];
    half_day_dates?: string[];
    permission_dates?: string[];
    weekoff_dates: string[];
  }) => api.post('/attendance/bulk', data),

  getMonthlyAttendance: (employeeId: number, month: number, year: number) =>
    api.get<AttendanceRecord[]>('/attendance/monthly', {
      params: { employee_id: employeeId, month, year },
    }),

  getReadiness: (month: number, year: number) =>
    api.get<{ employee_id: number; recorded_days: number; total_days: number; complete: boolean }[]>('/attendance/readiness', {
      params: { month, year },
    }),

  getLeaveSummary: (month: number, year: number) =>
    api.get<EmployeeLeaveSummary[]>('/attendance/leave-summary', {
      params: { month, year },
    }),
};
