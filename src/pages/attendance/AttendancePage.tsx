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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto">
      <h2 className="flex items-start gap-2.5 text-xl font-bold text-neutral-900 dark:text-white sm:items-center sm:text-2xl">
        <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 sm:mt-0" /> Attendance & Leave Management
      </h2>

      {error && (
        <div className="bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800 text-green-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      {/* Filters */}
      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Employee
            </label>
            {empLoading ? (
              <LoadingSpinner />
            ) : (
              <select
                value={selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(Number(e.target.value));
                  setDayStatuses(new Map());
                  setLastSynced('');
                  setSuccess('');
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
              >
                <option value={0} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  Select Employee
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setDayStatuses(new Map());
                setLastSynced('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setDayStatuses(new Map());
                setLastSynced('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {y}
                </option>
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
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {MONTH_NAMES[month - 1]} {year} — Click to cycle: Present → Leave → Weekoff
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Weekoffs are paid days (no deduction). Only Leave days are deducted from salary.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                onClick={clearAll}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
              <GradientButton onClick={handleSave} isLoading={bulkMark.isPending}>
                <Save className="h-4 w-4 mr-1.5" /> Save Attendance
              </GradientButton>
            </div>
          </div>

          {attLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2 sm:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 py-1">
                    {d}
                  </div>
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

                  let bgClass = 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 hover:border-black dark:hover:border-white';
                  let label = 'Present';
                  if (status === 'leave') {
                    bgClass = 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm';
                    label = 'LEAVE';
                  } else if (status === 'weekoff') {
                    bgClass = 'bg-blue-600 text-white border-blue-600 shadow-sm';
                    label = 'WEEKOFF';
                  }

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => cycleStatus(dateStr)}
                      className={`min-w-0 rounded-xl border p-1 text-center text-xs font-medium transition-all sm:border-2 sm:p-3 sm:text-sm ${bgClass}`}
                    >
                      <span className="block text-sm font-bold sm:text-lg">{day}</span>
                      <span className="hidden text-[10px] mt-0.5 sm:block font-semibold tracking-wider">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Summary */}
              <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-6 text-xs sm:text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Present ({presentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-neutral-900 dark:bg-white rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Leave ({leaveCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Weekoff ({weekoffCount})</span>
                </div>
                <div className="w-full font-bold text-neutral-900 dark:text-white sm:ml-auto sm:w-auto text-xs sm:text-sm">
                  Working Days: {presentCount + weekoffCount} | Leave: {leaveCount} | Total: {totalDays}
                </div>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Leave Summary for All Employees (Enterprise Plan Feature) */}
      {isEnterprise && (
        <GlassCard>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-4">
            Leave Summary — {MONTH_NAMES[month - 1]} {year}
          </h3>
          {leaveSummary && leaveSummary.length > 0 ? (
            <>
              <div className="space-y-3 md:hidden">
                {leaveSummary.map((s) => (
                  <div key={s.employee_id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/60">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-neutral-900 dark:text-white text-sm">{s.employee_name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.employee_code}</p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${s.leave_deduction > 0 ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
                        {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString()}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white dark:bg-neutral-800 p-2 border border-neutral-100 dark:border-neutral-700/60">
                        <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Total Days</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.total_days}</span>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-neutral-800 p-2 border border-neutral-100 dark:border-neutral-700/60">
                        <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Present</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.present_days}</span>
                      </div>
                      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 border border-blue-100 dark:border-blue-900/60">
                        <span className="block text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">Weekoff</span>
                        <span className="font-bold text-blue-800 dark:text-blue-300">{s.weekoff_days}</span>
                      </div>
                      <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 p-2 border border-neutral-200 dark:border-neutral-700/60">
                        <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Leave</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.leave_days}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto pb-1 md:block">
                <div className="grid min-w-[760px] grid-cols-7 gap-4 px-4 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold uppercase tracking-wider mb-2">
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
                    <div
                      key={s.employee_id}
                      className="grid min-w-[760px] grid-cols-7 gap-4 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-xl transition-colors text-sm"
                    >
                      <span className="font-semibold text-neutral-900 dark:text-white">{s.employee_name}</span>
                      <span className="text-neutral-500 dark:text-neutral-400 font-mono text-xs">{s.employee_code}</span>
                      <span className="text-center text-neutral-700 dark:text-neutral-300">{s.total_days}</span>
                      <span className="text-center text-neutral-700 dark:text-neutral-300">{s.present_days}</span>
                      <span className={`text-center font-bold ${s.weekoff_days > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400'}`}>
                        {s.weekoff_days}
                      </span>
                      <span className={`text-center font-bold ${s.leave_days > 0 ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
                        {s.leave_days}
                      </span>
                      <span className={`text-right font-bold ${s.leave_deduction > 0 ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
                        {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">No attendance data recorded for this month.</p>
          )}
        </GlassCard>
      )}
    </motion.div>
  );
}
