import { useEffect, useState } from 'react';
import api from '../../services/api';

type Leave = { id: number; employee_name: string; emp_id: string; request_type: string; start_date: string; end_date: string; reason: string; status: string };
const endpoint = '/api/attendance/leave-action/';
// Use the payroll API client's CSRF/session handling with the attendance API prefix.
const config = { baseURL: (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '') };

export function LeaveApprovals() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const refresh = async () => {
    try {
      const result = await api.get<{ leave_requests: Leave[] }>(endpoint, config);
      setLeaves(result.data.leave_requests);
      setError('');
    } catch { setError('Unable to load leave requests. Please retry.'); }
  };
  useEffect(() => { void refresh(); }, []);
  const decide = async (id: number, action: string) => {
    setBusy(id);
    try {
      await api.post(endpoint, { request_id: id, action }, config);
      await refresh();
    } catch { setError('Unable to update this request. Refresh and try again.'); }
    finally { setBusy(null); }
  };
  return <section className="rounded-2xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Employee leave requests</h2><button type="button" onClick={() => void refresh()} className="text-sm underline">Refresh</button></div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!leaves.length && !error && <p className="text-sm text-neutral-500">No leave requests yet.</p>}
    {leaves.map(leave => <article key={leave.id} className="rounded-xl bg-neutral-50 dark:bg-neutral-900 p-3 space-y-2">
      <p className="font-medium">{leave.employee_name} ({leave.emp_id})</p>
      <p className="text-sm">{leave.request_type} · {leave.start_date} to {leave.end_date}</p>
      <p className="text-sm whitespace-pre-wrap break-words">{leave.reason}</p>
      {leave.status === 'PENDING' ? <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy === leave.id} onClick={() => void decide(leave.id, 'APPROVED')} className="rounded-lg px-4 py-2 bg-emerald-700 text-white disabled:opacity-50">Approve</button>
        <button type="button" disabled={busy === leave.id} onClick={() => void decide(leave.id, 'REJECTED')} className="rounded-lg px-4 py-2 bg-red-700 text-white disabled:opacity-50">Reject</button>
      </div> : <p className="text-sm font-medium">{leave.status}</p>}
    </article>)}
  </section>;
}
