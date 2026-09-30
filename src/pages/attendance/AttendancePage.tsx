import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Save, Trash2, ChevronDown, ChevronUp, Filter, CheckCircle, X } from 'lucide-react';
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

type DayStatus = 'present' | 'leave' | 'half_day' | 'permission' | 'weekoff';

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function AttendancePage() {
  const { user } = useAuth();
  const canViewReports = hasMinimumPlan(user, 'professional');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [dayStatuses, setDayStatuses] = useState<Map<string, DayStatus>>(new Map());
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(true);
  const [reportFilter, setReportFilter] = useState<'all' | 'leaves' | 'deductions'>('all');

  const { data: empData, isLoading: empLoading } = useEmployees(1, undefined, undefined);
  const employees = empData?.items || [];

  const { data: attendance, isLoading: attLoading } = useMonthlyAttendance(
    selectedEmployee, month, year
  );
  const { data: leaveSummary, isLoading: summaryLoading } = useLeaveSummary(month, year);
  const bulkMark = useBulkMarkLeaves();

  // Sync attendance data from server to local state whenever attendance query completes or filters change
  useEffect(() => {
    if (attendance && attendance.length > 0) {
      const statuses = new Map<string, DayStatus>();
      attendance.forEach((a) => {
        statuses.set(a.date, a.status as DayStatus);
      });
      setDayStatuses(statuses);
    } else {
      setDayStatuses(new Map());
    }
  }, [attendance, selectedEmployee, month, year]);

  // Auto-dismiss success notification after 4 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [success]);

  // Auto-dismiss error notification after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError('');
    }, 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const totalDays = getDaysInMonth(month, year);

  // Cycle: present → leave (1.0) → half_day (0.5) → permission (0.25) → weekoff (0) → present
  const cycleStatus = (dateStr: string) => {
    setDayStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(dateStr) || 'present';
      if (current === 'present') next.set(dateStr, 'leave');
      else if (current === 'leave') next.set(dateStr, 'half_day');
      else if (current === 'half_day') next.set(dateStr, 'permission');
      else if (current === 'permission') next.set(dateStr, 'weekoff');
      else next.set(dateStr, 'present');
      return next;
    });
    setSuccess('');
    setError('');
  };

  const handleSave = () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    setError('');
    setSuccess('');

    const leaveDatesList: string[] = [];
    const halfDayDatesList: string[] = [];
    const permissionDatesList: string[] = [];
    const weekoffDatesList: string[] = [];
    dayStatuses.forEach((status, dateStr) => {
      if (status === 'leave') leaveDatesList.push(dateStr);
      else if (status === 'half_day') halfDayDatesList.push(dateStr);
      else if (status === 'permission') permissionDatesList.push(dateStr);
      else if (status === 'weekoff') weekoffDatesList.push(dateStr);
    });

    bulkMark.mutate(
      {
        employee_id: selectedEmployee,
        month,
        year,
        leave_dates: leaveDatesList,
        half_day_dates: halfDayDatesList,
        permission_dates: permissionDatesList,
        weekoff_dates: weekoffDatesList,
      },
      {
        onSuccess: () => {
          const parts = [];
          if (leaveDatesList.length) parts.push(`${leaveDatesList.length} leave`);
          if (halfDayDatesList.length) parts.push(`${halfDayDatesList.length} half day`);
          if (permissionDatesList.length) parts.push(`${permissionDatesList.length} permission`);
          if (weekoffDatesList.length) parts.push(`${weekoffDatesList.length} weekoff`);
          const summaryStr = parts.length ? parts.join(', ') : 'all present';
          setSuccess(
            `Attendance saved successfully (${summaryStr}) for ${MONTH_NAMES[month - 1]} ${year}.`
          );
        },
        onError: (err: any) => {
          setError(err?.response?.data?.detail || 'Failed to save attendance.');
        },
      }
    );
  };

  const clearAll = () => {
    setDayStatuses(new Map());
    setSuccess('');
    setError('');
  };

  // Count stats
  let leaveCount = 0;
  let halfDayCount = 0;
  let permissionCount = 0;
  let weekoffCount = 0;
  dayStatuses.forEach((status) => {
    if (status === 'leave') leaveCount++;
    else if (status === 'half_day') halfDayCount++;
    else if (status === 'permission') permissionCount++;
    else if (status === 'weekoff') weekoffCount++;
  });
  const presentCount = totalDays - leaveCount - halfDayCount - permissionCount - weekoffCount;

  // Filtered leave summary
  const filteredSummary = (leaveSummary || []).filter((s) => {
    if (reportFilter === 'leaves') {
      return s.leave_days > 0 || (s.half_day_days || 0) > 0 || (s.permission_days || 0) > 0;
    }
    if (reportFilter === 'deductions') return s.leave_deduction > 0;
    return true;
  });

  // Calculate totals for report footer
  const totalEmployeesCount = filteredSummary.length;
  const totalLeavesSum = filteredSummary.reduce((acc, curr) => acc + curr.leave_days, 0);
  const totalHalfDaysSum = filteredSummary.reduce((acc, curr) => acc + (curr.half_day_days || 0), 0);
  const totalPermissionsSum = filteredSummary.reduce((acc, curr) => acc + (curr.permission_days || 0), 0);
  const totalDeductionsSum = filteredSummary.reduce((acc, curr) => acc + curr.leave_deduction, 0);
  const totalNetPayableSum = filteredSummary.reduce((acc, curr) => acc + (curr.net_payable || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto pb-10">
      <h2 className="flex items-start gap-2.5 text-xl font-bold text-neutral-900 dark:text-white sm:items-center sm:text-2xl">
        <CalendarDays className="mt-0.5 h-6 w-6 shrink-0 sm:mt-0" /> {canViewReports ? 'Attendance & Leave Management' : 'Monthly Attendance'}
      </h2>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error-alert"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 dark:text-rose-400 dark:hover:text-rose-200 p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            key="success-alert"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 p-0.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Header */}
      <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
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
                  setSuccess('');
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
              >
                <option value={0} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  Select Employee (Overview)
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
                setSuccess('');
                setError('');
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
                setSuccess('');
                setError('');
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

      {/* Calendar Grid (Shown when an Employee is selected) */}
      {selectedEmployee > 0 && (
        <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {MONTH_NAMES[month - 1]} {year} — Click to cycle: Present → Leave → Half Day → Permission → Weekoff
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Full Leave deducts 1 day, Half Day deducts 0.5 day, Permission deducts 0.25 day. Weekoffs are paid (no deduction).
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
                    bgClass = 'bg-rose-600 text-white border-rose-600 shadow-sm';
                    label = 'LEAVE (1.0)';
                  } else if (status === 'half_day') {
                    bgClass = 'bg-amber-500 text-white border-amber-500 shadow-sm';
                    label = 'HALF DAY (½)';
                  } else if (status === 'permission') {
                    bgClass = 'bg-purple-600 text-white border-purple-600 shadow-sm';
                    label = 'PERM (¼)';
                  } else if (status === 'weekoff') {
                    bgClass = 'bg-blue-600 text-white border-blue-600 shadow-sm';
                    label = 'WEEKOFF';
                  }

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => cycleStatus(dateStr)}
                      className={`min-w-0 rounded-xl border p-1 text-center text-xs font-medium transition-all sm:border-2 sm:p-2.5 sm:text-sm ${bgClass}`}
                    >
                      <span className="block text-sm font-bold sm:text-lg">{day}</span>
                      <span className="hidden text-[9px] mt-0.5 sm:block font-bold tracking-tight uppercase">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Summary Legend */}
              <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-3 sm:gap-6 text-xs sm:text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Present ({presentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-rose-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Leave ({leaveCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-amber-500 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Half Day ({halfDayCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-purple-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Perm ({permissionCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded" />
                  <span className="text-neutral-600 dark:text-neutral-300">Weekoff ({weekoffCount})</span>
                </div>
                <div className="w-full font-bold text-neutral-900 dark:text-white sm:ml-auto sm:w-auto text-xs sm:text-sm">
                  Working: {presentCount + weekoffCount} | Leaves: {leaveCount + (halfDayCount * 0.5) + (permissionCount * 0.25)}d | Total: {totalDays}d
                </div>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Month-wise Leave & Salary Summary Report */}
      {canViewReports && <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                Leave Summary — {MONTH_NAMES[month - 1]} {year}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {totalEmployeesCount} {totalEmployeesCount === 1 ? 'Employee' : 'Employees'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Overall monthly attendance, deductions & net payable calculation
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter Dropdown */}
            <div className="relative inline-flex items-center">
              <Filter className="absolute left-3 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
              <select
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value as any)}
                className="pl-8 pr-7 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 outline-none hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="all" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">All Employees</option>
                <option value="leaves" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">With Leaves Only</option>
                <option value="deductions" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">With Deductions Only</option>
              </select>
              <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            </div>

            {/* Expand / Collapse Dropdown Button */}
            <button
              type="button"
              onClick={() => setIsReportOpen(!isReportOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm"
              title={isReportOpen ? 'Hide overall report' : 'Show overall report'}
            >
              <span>{isReportOpen ? 'Collapse' : 'Expand Report'}</span>
              {isReportOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {isReportOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden pt-4"
            >
              {summaryLoading ? (
                <div className="py-8 flex justify-center">
                  <LoadingSpinner />
                </div>
              ) : filteredSummary && filteredSummary.length > 0 ? (
                <>
                  {/* Mobile Card View (md:hidden) */}
                  <div className="space-y-3 md:hidden">
                    {filteredSummary.map((s) => (
                      <div key={s.employee_id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/60">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-bold text-neutral-900 dark:text-white text-sm">{s.employee_name}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.employee_code}</p>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400">Net Payable</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{s.net_payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
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
                          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-2 border border-rose-100 dark:border-rose-900/60">
                            <span className="block text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">Full Leave (1.0)</span>
                            <span className="font-bold text-rose-800 dark:text-rose-300">{s.leave_days}</span>
                          </div>
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2 border border-amber-100 dark:border-amber-900/60">
                            <span className="block text-[10px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Half Day (0.5)</span>
                            <span className="font-bold text-amber-800 dark:text-amber-300">{s.half_day_days || 0}</span>
                          </div>
                          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/40 p-2 border border-purple-100 dark:border-purple-900/60">
                            <span className="block text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold">Permission (0.25)</span>
                            <span className="font-bold text-purple-800 dark:text-purple-300">{s.permission_days || 0}</span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs font-semibold">
                          <span className="text-neutral-500 dark:text-neutral-400">Leave Deduction:</span>
                          <span className={s.leave_deduction > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-400'}>
                            {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (md:block) with 100% Guaranteed Alignment */}
                  <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700/80 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-neutral-100/90 dark:bg-neutral-800/90">
                        <tr className="text-xs font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700">
                          <th className="py-3.5 px-4 text-left text-neutral-700 dark:text-neutral-200">Employee</th>
                          <th className="py-3.5 px-4 text-left text-neutral-700 dark:text-neutral-200">Code</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Total Days</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Present</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Weekoff</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Leave</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Half Day</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Permission</th>
                          <th className="py-3.5 px-4 text-right text-neutral-700 dark:text-neutral-200">Deduction</th>
                          <th className="py-3.5 px-4 text-right text-neutral-700 dark:text-neutral-200">Net Payable</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white/40 dark:bg-neutral-900/40 text-sm">
                        {filteredSummary.map((s) => (
                          <tr
                            key={s.employee_id}
                            className={`transition-colors hover:bg-neutral-100/60 dark:hover:bg-neutral-800/50 ${selectedEmployee === s.employee_id ? 'bg-neutral-100/80 dark:bg-neutral-800/70 font-medium' : ''}`}
                          >
                            <td className="py-3.5 px-4 font-semibold text-neutral-900 dark:text-white">
                              {s.employee_name}
                            </td>
                            <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-300 font-mono text-xs">
                              {s.employee_code}
                            </td>
                            <td className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200 font-medium">
                              {s.total_days}
                            </td>
                            <td className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200 font-medium">
                              {s.present_days}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${s.weekoff_days > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.weekoff_days}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${s.leave_days > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.leave_days}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${(s.half_day_days || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.half_day_days || 0}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${(s.permission_days || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.permission_days || 0}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-bold ${s.leave_deduction > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.leave_deduction > 0 ? `₹${s.leave_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{s.net_payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Summary Table Footer */}
                      <tfoot>
                        <tr className="bg-neutral-100/90 dark:bg-neutral-800/80 border-t-2 border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-900 dark:text-white">
                          <td className="py-3.5 px-4" colSpan={2}>
                            Total ({totalEmployeesCount} Employees)
                          </td>
                          <td className="py-3.5 px-3 text-center text-neutral-400 dark:text-neutral-500">—</td>
                          <td className="py-3.5 px-3 text-center text-neutral-400 dark:text-neutral-500">—</td>
                          <td className="py-3.5 px-3 text-center text-neutral-400 dark:text-neutral-500">—</td>
                          <td className="py-3.5 px-3 text-center text-sm font-extrabold text-rose-600 dark:text-rose-400">
                            {totalLeavesSum}
                          </td>
                          <td className="py-3.5 px-3 text-center text-sm font-extrabold text-amber-600 dark:text-amber-400">
                            {totalHalfDaysSum}
                          </td>
                          <td className="py-3.5 px-3 text-center text-sm font-extrabold text-purple-600 dark:text-purple-400">
                            {totalPermissionsSum}
                          </td>
                          <td className="py-3.5 px-4 text-right text-sm font-extrabold text-rose-600 dark:text-rose-400">
                            {totalDeductionsSum > 0 ? `₹${totalDeductionsSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            ₹{totalNetPayableSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 py-4 text-center">
                  No attendance records found for {MONTH_NAMES[month - 1]} {year}.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>}
    </motion.div>
  );
}
