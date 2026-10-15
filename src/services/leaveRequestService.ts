import api from './api';

export interface EmployeeLeaveRequest {
  id: number;
  employee_name: string;
  emp_id: string;
  request_type: string;
  start_date: string;
  end_date: string;
  duration_hours?: number | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

const attendanceApiConfig = {
  baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''),
};
const endpoint = '/api/attendance/leave-action/';

export async function listEmployeeLeaveRequests(): Promise<EmployeeLeaveRequest[]> {
  try {
    const response = await api.get<{ leave_requests: EmployeeLeaveRequest[] }>(endpoint, attendanceApiConfig);
    return response.data?.leave_requests || [];
  } catch (err) {
    try {
      const fallbackResponse = await api.get<{ leave_requests: EmployeeLeaveRequest[] }>('/attendance/leave-action/');
      return fallbackResponse.data?.leave_requests || [];
    } catch {
      throw err;
    }
  }
}

export async function reviewEmployeeLeaveRequest(id: number, action: 'APPROVED' | 'REJECTED') {
  try {
    await api.post(endpoint, { request_id: id, action }, attendanceApiConfig);
  } catch (err) {
    try {
      await api.post('/attendance/leave-action/', { request_id: id, action });
    } catch {
      throw err;
    }
  }
}
