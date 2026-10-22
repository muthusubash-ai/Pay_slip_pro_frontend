import api from './api';

export interface MissedCheckout {
  id: number;
  employee_id?: number | null;
  emp_id: string;
  employee_name: string;
  date: string;
  check_in?: string | null;
}

const attendanceApiConfig = {
  baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''),
};
const missedCheckoutsEndpoint = '/api/attendance/missed-checkouts/';
const updateCheckoutEndpoint = '/api/attendance/update-checkout/';

export async function listMissedCheckouts(): Promise<MissedCheckout[]> {
  try {
    const response = await api.get<{ missed_checkouts: MissedCheckout[] }>(missedCheckoutsEndpoint, attendanceApiConfig);
    return response.data?.missed_checkouts || [];
  } catch (err) {
    try {
      const fallbackResponse = await api.get<{ missed_checkouts: MissedCheckout[] }>('/attendance/missed-checkouts/');
      return fallbackResponse.data?.missed_checkouts || [];
    } catch {
      throw err;
    }
  }
}

export async function updateAttendanceCheckout(id: number, checkOut: string) {
  try {
    await api.post(updateCheckoutEndpoint, { id, check_out: checkOut }, attendanceApiConfig);
  } catch (err) {
    try {
      await api.post('/attendance/update-checkout/', { id, check_out: checkOut });
    } catch {
      throw err;
    }
  }
}
