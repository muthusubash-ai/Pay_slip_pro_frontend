import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Save, Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployees } from '../../hooks/useEmployees';
import { useMonthlyAttendance, useBulkMarkLeaves, useLeaveSummary } from '../../hooks/useAttendance';
import { useAuth } from '../../context/AuthContext';
import { hasMinimumPlan } from '../../lib/plans';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type DayStatus = 'present' | 'leave' | 'weekoff';

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function AttendancePage() {
  const { user } = useAuth();
  const isEnterprise = hasMinimumPlan(user, 'enterprise');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [dayStatuses, setDayStatuses] = useState<Map<string, DayStatus>>(new Map());
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { data: empData, isLoading: empLoading } = useEmployees(1, undefined, undefined);
  const employees = empData?.items || [];

  const { data: attendance, isLoading: attLoading } = useMonthlyAttendance(
    selectedEmployee, month, year
  );
  const { data: leaveSummary } = useLeaveSummary(month, year);
  const bulkMark = useBulkMarkLeaves();

  // Sync attendance data to local state when it loads
  const syncFromServer = () => {
    if (attendance) {
      const statuses = new Map<string, DayStatus>();
      attendance.forEach((a) => {
        statuses.set(a.date, a.status as DayStatus);
      });
      setDayStatuses(statuses);
    }
  };

  // When attendance data changes, sync
  const [lastSynced, setLastSynced] = useState('');
  const syncKey = `${selectedEmployee}-${month}-${year}-${attendance?.length ?? 0}`;
  if (syncKey !== lastSynced && attendance) {
    syncFromServer();
    setLastSynced(syncKey);
  }

  const totalDays = getDaysInMonth(month, year);

  // Cycle: present → leave → weekoff → present
  const cycleStatus = (dateStr: string) => {
    setDayStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(dateStr) || 'present';
      if (current === 'present') next.set(dateStr, 'leave');
      else if (current === 'leave') next.set(dateStr, 'weekoff');
      else next.set(dateStr, 'present');
      return next;
    });
  };

  const handleSave = () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    setError('');
    setSuccess('');

    const leaveDatesList: string[] = [];
    const weekoffDatesList: string[] = [];
    dayStatuses.forEach((status, dateStr) => {
      if (status === 'leave') leaveDatesList.push(dateStr);
      else if (status === 'weekoff') weekoffDatesList.push(dateStr);
    });

    bulkMark.mutate(
      {
        employee_id: selectedEmployee,
        month,
        year,
        leave_dates: leaveDatesList,
        weekoff_dates: weekoffDatesList,
      },
      {
        onSuccess: () => {
          setSuccess(
            `Attendance saved: ${leaveDatesList.length} leave, ${weekoffDatesList.length} weekoff for ${MONTH_NAMES[month - 1]} ${year}.`
          );
        },
        onError: () => setError('Failed to save attendance.'),
      }
    );
  };

  const clearAll = () => setDayStatuses(new Map());

  // Count stats
  let leaveCount = 0;
  let weekoffCount = 0;
  dayStatuses.forEach((status) => {
    if (status === 'leave') leaveCount++;
    else if (status === 'weekoff') weekoffCount++;
  });
  const presentCount = totalDays - leaveCount - weekoffCount;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="flex items-start gap-2 text-xl font-bold text-black sm:items-center sm:text-2xl">
        <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 sm:mt-0" /> Attendance / Leave Management
      </h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">{success}</div>}

      {/* Filters */}
      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            {empLoading ? <LoadingSpinner /> : (
              <select
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(Number(e.target.value));
                  setDayStatuses(new Map());
                  setLastSynced('');
                  setSuccess('');
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
              >
                <option value={0}>Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setDayStatuses(new Map());
                setLastSynced('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setDayStatuses(new Map());
                setLastSynced('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-black outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Calendar Grid */}
      {selectedEmployee > 0 && (
        <GlassCard>
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-black">
                {MONTH_NAMES[month - 1]} {year} — Click to cycle: Present → Leave → Weekoff
              </h3>
              <p className="text-xs text-gray-500 mt-1">Weekoffs are paid days (no deduction). Only Leave days are deducted from salary.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                onClick={clearAll}
                className="flex min-h-10 items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
              <GradientButton onClick={handleSave} isLoading={bulkMark.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save Attendance
              </GradientButton>
            </div>
          </div>

          {attLoading ? <LoadingSpinner /> : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty cells for offset */}
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(year, month, day);
                  const status = dayStatuses.get(dateStr) || 'present';

                  let bgClass = 'bg-white text-black border-gray-200 hover:border-black';
                  let label = 'Present';
                  if (status === 'leave') {
                    bgClass = 'bg-black text-white border-black';
                    label = 'LEAVE';
                  } else if (status === 'weekoff') {
                    bgClass = 'bg-blue-500 text-white border-blue-500';
                    label = 'WEEKOFF';
                  }

                  return (
                    <button
                      key={day}
                      onClick={() => cycleStatus(dateStr)}
                      className={`min-w-0 rounded-lg border p-1 text-center text-xs font-medium transition-all sm:border-2 sm:p-3 sm:text-sm ${bgClass}`}
                    >
                      <span className="block text-sm font-bold sm:text-lg">{day}</span>
                      <span className="hidden text-[10px] mt-0.5 sm:block">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-4 flex items-center gap-6 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 border-gray-200 rounded" />
                  <span className="text-gray-600">Present ({presentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-black rounded" />
                  <span className="text-gray-600">Leave ({leaveCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span className="text-gray-600">Weekoff ({weekoffCount})</span>
                </div>
                <div className="w-full font-semibold text-black sm:ml-auto sm:w-auto">
                  Working Days: {presentCount + weekoffCount} | Leave: {leaveCount} | Total: {totalDays}
                </div>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Leave Summary for All Employees */}
      {isEnterprise && <GlassCard>
        <h3 className="text-lg font-semibold text-black mb-4">
          Leave Summary — {MONTH_NAMES[month - 1]} {year}
        </h3>
        {leaveSummary && leaveSummary.length > 0 ? (<>
          <div className="space-y-3 md:hidden">
            {leaveSummary.map((s) => (
              <div key={s.employee_id} className="rounded-xl border border-gray-100 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-black">{s.employee_name}</p>
                    <p className="text-xs text-gray-500">{s.employee_code}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${s.leave_deduction > 0 ? 'text-black' : 'text-gray-400'}`}>
                    {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString()}` : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-gray-50 p-2"><span className="block text-xs text-gray-500">Total Days</span>{s.total_days}</div>
                  <div className="rounded-lg bg-gray-50 p-2"><span className="block text-xs text-gray-500">Present</span>{s.present_days}</div>
                  <div className="rounded-lg bg-blue-50 p-2"><span className="block text-xs text-gray-500">Weekoff</span>{s.weekoff_days}</div>
                  <div className="rounded-lg bg-gray-100 p-2"><span className="block text-xs text-gray-500">Leave</span>{s.leave_days}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto pb-1 md:block">
            <div className="grid min-w-[760px] grid-cols-7 gap-4 px-3 py-2 bg-black text-white rounded-lg text-sm font-semibold mb-2">
              <span>Employee</span>
              <span>Code</span>
              <span className="text-center">Total Days</span>
              <span className="text-center">Present</span>
              <span className="text-center">Weekoff</span>
              <span className="text-center">Leave</span>
              <span className="text-right">Deduction</span>
            </div>
            <div className="space-y-1">
              {leaveSummary.map((s) => (
                <div key={s.employee_id} className="grid min-w-[760px] grid-cols-7 gap-4 px-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-lg">
                  <span className="font-medium text-black">{s.employee_name}</span>
                  <span className="text-gray-600">{s.employee_code}</span>
                  <span className="text-center text-gray-700">{s.total_days}</span>
                  <span className="text-center text-gray-700">{s.present_days}</span>
                  <span className={`text-center font-semibold ${s.weekoff_days > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                    {s.weekoff_days}
                  </span>
                  <span className={`text-center font-semibold ${s.leave_days > 0 ? 'text-black' : 'text-gray-400'}`}>
                    {s.leave_days}
                  </span>
                  <span className={`text-right font-semibold ${s.leave_deduction > 0 ? 'text-black' : 'text-gray-400'}`}>
                    {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString()}` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          </>
        ) : (
          <p className="text-gray-500">No attendance data recorded for this month.</p>
        )}
      </GlassCard>}
    </motion.div>
  );
}
