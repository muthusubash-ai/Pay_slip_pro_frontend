import api from './api';

export interface MissedCheckout {
  id: number;
  employee_id?: number | null;
  emp_id: string;
  employee_name: string;
  date: string;
  check_in?: string | null;
}

export interface MissedCheckin {
  id: number;
  employee_id?: number | null;
  emp_id: string;
  employee_name: string;
  date: string;
  expected_time?: string | null;
}

const attendanceApiConfig = {
  baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, ''),
};
const missedCheckoutsEndpoint = '/api/attendance/missed-checkouts/';
const updateCheckoutEndpoint = '/api/attendance/update-checkout/';
const missedCheckinsEndpoint = '/api/attendance/missed-checkins/';
const updateCheckinEndpoint = '/api/attendance/update-checkin/';

export async function listMissedCheckins(): Promise<MissedCheckin[]> {
  try {
    const response = await api.get<{ missed_checkins: MissedCheckin[] }>(missedCheckinsEndpoint, attendanceApiConfig);
    return response.data?.missed_checkins || [];
  } catch (err) {
    try {
      const fallbackResponse = await api.get<{ missed_checkins: MissedCheckin[] }>('/attendance/missed-checkins/');
      return fallbackResponse.data?.missed_checkins || [];
    } catch {
      throw err;
    }
  }
}

export async function updateAttendanceCheckin(
  id: number | null,
  checkIn: string,
  employeeId?: number | null,
  date?: string | null
) {
  const payload: any = { check_in: checkIn };
  if (id) payload.id = id;
  if (employeeId) payload.employee_id = employeeId;
  if (date) payload.date = date;

  try {
    return (await api.post(updateCheckinEndpoint, payload, attendanceApiConfig)).data;
  } catch (err) {
    try {
      return (await api.post('/attendance/update-checkin/', payload)).data;
    } catch {
      throw err;
    }
  }
}

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
