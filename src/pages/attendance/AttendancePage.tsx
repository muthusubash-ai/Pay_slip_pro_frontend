import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ArrowLeft, Save, Trash2, ChevronDown, ChevronUp, Filter, CheckCircle, X, Clock, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useEmployees } from '../../hooks/useEmployees';
import { useMonthlyAttendance, useBulkMarkLeaves, useLeaveSummary, useAttendanceReadiness } from '../../hooks/useAttendance';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { hasMinimumPlan } from '../../lib/plans';
import { companyService } from '../../services/companyService';
import type { AttendanceRecord } from '../../types';

type DayStatus = 'present' | 'leave' | 'half_day' | 'permission' | 'weekoff' | 'weekoff_halfday' | 'company_week_off';
// Admin only ever picks one of these 4 — Weekoff/Weekoff-Half are derived automatically,
// and Company Week Off days are locked entirely (see companyWeekOffDates).
type RawStatus = 'present' | 'leave' | 'half_day' | 'permission';

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function toRawStatus(status: DayStatus): RawStatus {
  if (status === 'weekoff') return 'leave';
  if (status === 'weekoff_halfday') return 'half_day';
  if (status === 'company_week_off') return 'present';
  return status;
}

// The monthly Weekoff is a single shared pool worth 2 half-day units: a full-day
// leave costs 2 units, a half-day leave costs 1 unit. Whichever comes first
// chronologically draws from the pool first - no partial credit. This mirrors
// the backend's allocate_weekoff_pool() in attendance_service.py.
const WEEKOFF_POOL_UNITS_PER_MONTH = 2;

function computeDisplayStatuses(rawStatuses: Map<string, RawStatus>, joiningDate: string): Map<string, DayStatus> {
  const combined: Array<{ date: string; kind: 'full' | 'half' }> = [];
  rawStatuses.forEach((st, d) => {
    if (joiningDate && d < joiningDate) return;
    if (st === 'leave') combined.push({ date: d, kind: 'full' });
    else if (st === 'half_day') combined.push({ date: d, kind: 'half' });
  });
  combined.sort((a, b) => a.date.localeCompare(b.date));

  const display = new Map<string, DayStatus>();
  rawStatuses.forEach((st, d) => display.set(d, st));

  let remaining = WEEKOFF_POOL_UNITS_PER_MONTH;
  combined.forEach(({ date: d, kind }) => {
    if (kind === 'full') {
      if (remaining >= 2) {
        display.set(d, 'weekoff');
        remaining -= 2;
      } else {
        display.set(d, 'leave');
      }
    } else if (remaining >= 1) {
      display.set(d, 'weekoff_halfday');
      remaining -= 1;
    } else {
      display.set(d, 'half_day');
    }
  });
  return display;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
}

export function AttendancePage() {
  const { user } = useAuth();
  const { t, monthNames, getMonthName } = useTranslation();
  const navigate = useNavigate();
  const canViewReports = hasMinimumPlan(user, 'professional');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<number>(0);
  const [dayStatuses, setDayStatuses] = useState<Map<string, RawStatus>>(new Map());
  const [biometricMap, setBiometricMap] = useState<Map<string, AttendanceRecord>>(new Map());
  // Dates the backend reports as the company's standing weekly off (e.g. every Sunday) —
  // always free, locked from editing, sourced straight from the server (source of truth).
  const [companyWeekOffDates, setCompanyWeekOffDates] = useState<Set<string>>(new Set());
  const [showBiometricTimesheet, setShowBiometricTimesheet] = useState<boolean>(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [quotaWarning, setQuotaWarning] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'leaves' | 'deductions'>('all');

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyService.get().then((r) => r.data),
    enabled: !!user,
  });
  const permissionAllowance = company?.permission_days_per_month ?? 3;

  const { data: empData, isLoading: empLoading } = useEmployees(1, undefined, undefined);
  const employees = empData?.items || [];
  const selectedEmp = employees.find((employee) => employee.id === selectedEmployee);
  const joiningDate = selectedEmp?.date_of_joining || '';
  const totalDays = getDaysInMonth(month, year);
  const beforeJoiningMonth = Boolean(joiningDate && formatDate(year, month, totalDays) < joiningDate);
  const firstActiveDay = joiningDate && joiningDate.slice(0, 7) === formatDate(year, month, 1).slice(0, 7)
    ? Number(joiningDate.slice(8, 10)) : 1;
  const activeDays = beforeJoiningMonth ? 0 : totalDays - firstActiveDay + 1;

  const { data: attendance, isLoading: attLoading } = useMonthlyAttendance(
    selectedEmployee, month, year, !beforeJoiningMonth
  );
  const { data: leaveSummary, isLoading: summaryLoading } = useLeaveSummary(month, year);
  const { data: readiness } = useAttendanceReadiness(month, year);
  const notJoinedCount = readiness?.filter((item) => !item.eligible).length || 0;
  const bulkMark = useBulkMarkLeaves();

  // Sync attendance data and biometric records from server to local state whenever query completes
  useEffect(() => {
    if (attendance && attendance.length > 0) {
      const statuses = new Map<string, RawStatus>();
      const bioMap = new Map<string, AttendanceRecord>();
      const weekOffDates = new Set<string>();
      attendance.forEach((a) => {
        statuses.set(a.date, toRawStatus(a.status as DayStatus));
        bioMap.set(a.date, a);
        if ((a.status as unknown as string) === 'company_week_off') weekOffDates.add(a.date);
      });
      setDayStatuses(statuses);
      setBiometricMap(bioMap);
      setCompanyWeekOffDates(weekOffDates);
    } else {
      setDayStatuses(new Map());
      setBiometricMap(new Map());
      setCompanyWeekOffDates(new Set());
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

  // Cycle: present → leave → half_day → permission → present.
  // Weekoff / Weekoff Half are derived automatically (see computeDisplayStatuses) —
  // the employee's first leave/month and first 2 half-days/month are free.
  const cycleStatus = (dateStr: string) => {
    if (joiningDate && dateStr < joiningDate) return;
    if (companyWeekOffDates.has(dateStr)) return;
    setSuccess('');
    setError('');

    setDayStatuses((prev) => {
      const next = new Map(prev);
      const current = next.get(dateStr) || 'present';
      if (current === 'present') {
        next.set(dateStr, 'leave');
      } else if (current === 'leave') {
        next.set(dateStr, 'half_day');
      } else if (current === 'half_day') {
        next.set(dateStr, 'permission');
      } else {
        next.set(dateStr, 'present');
      }
      return next;
    });
  };

  const displayStatuses = useMemo(() => {
    const base = computeDisplayStatuses(dayStatuses, joiningDate);
    // Company weekly-off days always win over the derived Leave/Weekoff display.
    companyWeekOffDates.forEach((d) => base.set(d, 'company_week_off'));
    return base;
  }, [dayStatuses, joiningDate, companyWeekOffDates]);

  // Warn when a Half Day won't be free because a full-day Weekoff already used up the
  // shared monthly pool (1 full day = 2 units, same pool as Weekoff Halfday).
  useEffect(() => {
    const hasFullWeekoff = Array.from(displayStatuses.values()).some((s) => s === 'weekoff');
    const hasDeductingHalfDay = Array.from(displayStatuses.values()).some((s) => s === 'half_day');
    setQuotaWarning(
      hasFullWeekoff && hasDeductingHalfDay
        ? 'This employee already used their monthly Weekoff (full day) this month, so the Half Day marked below is not free — it will deduct 0.5 day salary.'
        : ''
    );
  }, [displayStatuses]);

  const handleSave = () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    if (beforeJoiningMonth) {
      setError(`${selectedEmp?.full_name} joined on ${formatDisplayDate(joiningDate)}. Attendance cannot be saved for ${getMonthName(month)} ${year}.`);
      return;
    }
    setError('');
    setSuccess('');

    const leaveDatesList: string[] = [];
    const halfDayDatesList: string[] = [];
    const permissionDatesList: string[] = [];
    dayStatuses.forEach((status, dateStr) => {
      if (joiningDate && dateStr < joiningDate) return;
      if (status === 'leave') leaveDatesList.push(dateStr);
      else if (status === 'half_day') halfDayDatesList.push(dateStr);
      else if (status === 'permission') permissionDatesList.push(dateStr);
    });

    bulkMark.mutate(
      {
        employee_id: selectedEmployee,
        month,
        year,
        leave_dates: leaveDatesList,
        half_day_dates: halfDayDatesList,
        permission_dates: permissionDatesList,
      },
      {
        onSuccess: () => {
          const parts = [];
          if (leaveDatesList.length) parts.push(`${leaveDatesList.length} leave`);
          if (halfDayDatesList.length) parts.push(`${halfDayDatesList.length} half day`);
          if (permissionDatesList.length) parts.push(`${permissionDatesList.length} permission`);
          const summaryStr = parts.length ? parts.join(', ') : 'all present';
          setSuccess(
            `Attendance saved successfully (${summaryStr}) for ${getMonthName(month)} ${year}.`
          );
        },
        onError: (err: any) => {
          const data = err?.response?.data;
          let msg = 'Failed to save attendance.';
          if (typeof data?.detail === 'string') {
            msg = data.detail;
          } else if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
            msg = String(data.non_field_errors[0]);
          } else if (typeof data === 'string') {
            msg = data;
          } else if (data && typeof data === 'object') {
            const firstKey = Object.keys(data)[0];
            const val = data[firstKey];
            if (Array.isArray(val) && val.length) msg = `${firstKey}: ${val[0]}`;
            else if (typeof val === 'string') msg = val;
          }
          setError(msg);
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
  let weekoffHalfdayCount = 0;
  let companyWeekOffCount = 0;
  displayStatuses.forEach((status, dateStr) => {
    if (joiningDate && dateStr < joiningDate) return;
    if (status === 'leave') leaveCount++;
    else if (status === 'half_day') halfDayCount++;
    else if (status === 'permission') permissionCount++;
    else if (status === 'weekoff') weekoffCount++;
    else if (status === 'weekoff_halfday') weekoffHalfdayCount++;
    else if (status === 'company_week_off') companyWeekOffCount++;
  });
  const presentCount = activeDays - leaveCount - halfDayCount - permissionCount - weekoffCount - weekoffHalfdayCount - companyWeekOffCount;

  // Biometric statistics
  let totalDurationHours = 0;
  let lateArrivalsCount = 0;
  let bioPunchDaysCount = 0;
  biometricMap.forEach((rec, dStr) => {
    if (joiningDate && dStr < joiningDate) return;
    if (rec.duration_hours) totalDurationHours += rec.duration_hours;
    if (rec.is_late) lateArrivalsCount++;
    if (rec.check_in) bioPunchDaysCount++;
  });

  const isSelectedEmpJoiningMonth = Boolean(
    joiningDate &&
    joiningDate.slice(0, 7) === formatDate(year, month, 1).slice(0, 7) &&
    firstActiveDay > 1
  );

  const estimatedSalary = (() => {
    if (!selectedEmp) return 0;
    const fullGross = Number(selectedEmp.basic_salary || 0) +
      Number(selectedEmp.hra || 0) +
      Number(selectedEmp.conveyance_allowance || 0) +
      Number(selectedEmp.medical_allowance || 0) +
      Number(selectedEmp.special_allowance || 0);

    const fullDeductions = Number(selectedEmp.pf_deduction || 0) +
      Number(selectedEmp.professional_tax || 0) +
      Number(selectedEmp.tds || 0) +
      Number(selectedEmp.esi || 0);

    const proration = isSelectedEmpJoiningMonth ? (activeDays / totalDays) : 1.0;

    const proratedGross = Math.round(fullGross * proration * 100) / 100;
    const proratedDeductions = Math.round(fullDeductions * proration * 100) / 100;

    const excessPermissions = Math.max(0, permissionCount - permissionAllowance);
    const effectiveLeaves = leaveCount + (halfDayCount * 0.5) + (excessPermissions * 1.0);
    const perDayRate = totalDays > 0 ? fullGross / totalDays : 0;
    const leaveDeduction = Math.round(effectiveLeaves * perDayRate * 100) / 100;

    return Math.max(0, Math.round((proratedGross - proratedDeductions - leaveDeduction) * 100) / 100);
  })();

  // Filtered leave summary
  const filteredSummary = (leaveSummary || []).filter((s) => {
    if (reportFilter === 'leaves') {
      return (
        s.leave_days > 0 ||
        (s.half_day_days || 0) > 0 ||
        (s.permission_days || 0) > 0 ||
        (s.weekoff_halfday_days || 0) > 0
      );
    }
    if (reportFilter === 'deductions') return s.leave_deduction > 0;
    return true;
  });

  // Calculate totals for report footer
  const totalEmployeesCount = filteredSummary.length;
  const totalLeavesSum = filteredSummary.reduce((acc, curr) => acc + curr.leave_days, 0);
  const totalHalfDaysSum = filteredSummary.reduce((acc, curr) => acc + (curr.half_day_days || 0), 0);
  const totalPermissionsSum = filteredSummary.reduce((acc, curr) => acc + (curr.permission_days || 0), 0);
  const totalWeekoffHalfSum = filteredSummary.reduce((acc, curr) => acc + (curr.weekoff_halfday_days || 0), 0);
  const totalCompanyWeekOffSum = filteredSummary.reduce((acc, curr) => acc + (curr.company_week_off_days || 0), 0);
  const totalDeductionsSum = filteredSummary.reduce((acc, curr) => acc + curr.leave_deduction, 0);
  const totalNetPayableSum = filteredSummary.reduce((acc, curr) => acc + (curr.net_payable || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-wrap min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/dashboard');
              }
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-white transition-colors p-1 -ml-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title={t('common.back', 'Back')}
            aria-label={t('common.back', 'Back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">
            <CalendarDays className="h-6 w-6 shrink-0" /> {canViewReports ? t('attendance.title', 'Attendance & Leave Management') : t('attendance.monthlyAttendance', 'Monthly Attendance')}
          </h2>
        </div>
      </div>

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
        {quotaWarning && (
          <motion.div
            key="quota-warning-alert"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl text-sm shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{quotaWarning}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Header */}
      <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('attendance.employee', 'Employee')}
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
                  {t('attendance.selectEmployee', 'Select Employee (Overview)')}
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
              {t('attendance.month', 'Month')}
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
              {monthNames.map((name, i) => (
                <option key={i} value={i + 1} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              {t('attendance.year', 'Year')}
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

      {selectedEmp && beforeJoiningMonth && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Attendance unavailable for {getMonthName(month)} {year}.</strong>{' '}
          {selectedEmp.full_name} joined on {formatDisplayDate(joiningDate)}. Select the joining month or a later month to view and save attendance.
        </div>
      )}

      {/* Calendar Grid (Shown only from the employee's joining month) */}
      {selectedEmployee > 0 && !beforeJoiningMonth && (
        <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
          <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {monthNames[month - 1]} {year} — {t('attendance.cycleHelp', 'Click to cycle: Present → Leave → Half Day → Permission')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                The monthly Weekoff is a shared pool worth 2 half-day units: a Leave costs 2 units (free only if both are still available), a Half Day costs 1 unit — whichever is marked first (by date) draws from the pool first, with no partial credit. Up to {permissionAllowance} permission{permissionAllowance === 1 ? '' : 's'}/month allowed with 0 deduction (excess permissions deduct 1 day each — configurable in Settings → Company). Days matching the company's configured Weekly Off (Settings → Company) are locked as "Company Off" — always paid, never deducted.
              </p>
              {firstActiveDay > 1 && <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Joined on {joiningDate}. Days before joining are locked and excluded.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                onClick={clearAll}
                className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t('attendance.clear', 'Clear')}
              </button>
              <GradientButton onClick={handleSave} isLoading={bulkMark.isPending}>
                <Save className="h-4 w-4 mr-1.5" /> {t('attendance.saveAttendance', 'Save Attendance')}
              </GradientButton>
            </div>
          </div>

          {attLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2 sm:gap-2">
                {[
                  t('attendance.sun', 'Sun'),
                  t('attendance.mon', 'Mon'),
                  t('attendance.tue', 'Tue'),
                  t('attendance.wed', 'Wed'),
                  t('attendance.thu', 'Thu'),
                  t('attendance.fri', 'Fri'),
                  t('attendance.sat', 'Sat'),
                ].map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {/* Empty cells for offset */}
                {Array.from({ length: new Date(year, month - 1, 1).getDay() }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {Array.from({ length: totalDays }, (_, i) => {
                  const day = i + 1;
                  const dateStr = formatDate(year, month, day);
                  const beforeJoiningDay = Boolean(joiningDate && dateStr < joiningDate);
                  const isCompanyWeekOff = companyWeekOffDates.has(dateStr);
                  const status = displayStatuses.get(dateStr) || 'present';
                  const bio = biometricMap.get(dateStr);

                  let bgClass = 'bg-white dark:bg-[#18181b] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#27272a] hover:border-neutral-400 dark:hover:border-neutral-600';
                  let label = 'PRESENT';
                  if (status === 'leave') {
                    bgClass = 'bg-rose-600 text-white border-transparent shadow-sm';
                    label = 'LEAVE';
                  } else if (status === 'half_day') {
                    bgClass = 'bg-amber-500 text-white border-transparent shadow-sm';
                    label = 'HALF DAY';
                  } else if (status === 'permission') {
                    bgClass = 'bg-purple-600 text-white border-transparent shadow-sm';
                    label = 'PERMISSION';
                  } else if (status === 'weekoff') {
                    bgClass = 'bg-blue-600 text-white border-transparent shadow-sm';
                    label = 'WEEKOFF';
                  } else if (status === 'weekoff_halfday') {
                    bgClass = 'bg-teal-600 text-white border-transparent shadow-sm';
                    label = 'WKOFF HALF';
                  } else if (status === 'company_week_off') {
                    bgClass = 'bg-slate-500 text-white border-transparent shadow-sm';
                    label = 'COMPANY OFF';
                  }

                  const locked = beforeJoiningDay || isCompanyWeekOff;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={locked}
                      aria-label={beforeJoiningDay ? `${dateStr}: before joining date` : `${dateStr}: ${label}`}
                      onClick={() => cycleStatus(dateStr)}
                      className={`min-w-0 rounded-2xl p-2.5 sm:p-3 text-center transition-all flex flex-col items-center justify-center min-h-[64px] sm:min-h-[76px] group relative ${
                        beforeJoiningDay
                          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-600'
                          : isCompanyWeekOff
                          ? `cursor-not-allowed ${bgClass}`
                          : `cursor-pointer ${bgClass}`
                      }`}
                    >
                      <span className="block text-base sm:text-lg font-extrabold tracking-tight leading-none mb-1">
                        {day}
                      </span>

                      <span className="text-[9px] sm:text-[10px] font-bold tracking-wider uppercase leading-none opacity-90">
                        {beforeJoiningDay ? 'Not Joined' : label}
                      </span>

                      {/* Small late arrival indicator badge */}
                      {bio?.is_late && !beforeJoiningDay && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-neutral-900" title="Late arrival punch" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Summary Legend matching screenshot */}
              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-4 sm:gap-6 text-xs sm:text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded border border-neutral-400 dark:border-neutral-600 bg-transparent" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Present ({presentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-600" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Leave ({leaveCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Half Day ({halfDayCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-purple-600" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Perm ({permissionCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-blue-600" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Weekoff ({weekoffCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-teal-600" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Wkoff Half ({weekoffHalfdayCount}/2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-slate-500" />
                  <span className="text-neutral-600 dark:text-neutral-300 font-medium">Company Off ({companyWeekOffCount})</span>
                </div>

                {/* Biometric summary stats */}
                {totalDurationHours > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-bold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Total Worked: {totalDurationHours.toFixed(1)} hrs</span>
                  </div>
                )}

                {lateArrivalsCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Late Punches: {lateArrivalsCount}</span>
                  </div>
                )}

                <div className="w-full flex items-center justify-between sm:justify-end gap-2.5 font-bold text-neutral-900 dark:text-white sm:ml-auto sm:w-auto text-xs sm:text-sm flex-wrap">
                  <span>Working: {presentCount + weekoffCount + weekoffHalfdayCount + companyWeekOffCount}</span>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <span>Leaves: {leaveCount + (halfDayCount * 0.5) + (Math.max(0, permissionCount - permissionAllowance) * 1.0)}d</span>
                  <span className="text-neutral-300 dark:text-neutral-700">|</span>
                  <span>Eligible: {activeDays}d{isSelectedEmpJoiningMonth ? ` (from ${formatDisplayDate(joiningDate)})` : ''}</span>
                  {selectedEmp && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-700">|</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Est. Net Pay: ₹{estimatedSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {isSelectedEmpJoiningMonth && <span className="ml-1 text-[11px] font-normal text-amber-600 dark:text-amber-400">(joining prorated)</span>}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </GlassCard>
      )}

      {/* Biometric Daily Punch Audit & Working Hours Breakdown */}
      {selectedEmployee > 0 && !beforeJoiningMonth && (
        <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
          <div 
            onClick={() => setShowBiometricTimesheet(!showBiometricTimesheet)}
            className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer select-none transition-colors ${showBiometricTimesheet ? 'pb-3 border-b border-neutral-100 dark:border-neutral-800' : ''}`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                Biometric Punch Timesheet & Daily Hours ({selectedEmp?.full_name})
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                {bioPunchDaysCount} Punches Recorded
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBiometricTimesheet(!showBiometricTimesheet);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              <span>{showBiometricTimesheet ? 'Hide Daily Logs' : 'Show Daily Logs'}</span>
              {showBiometricTimesheet ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Collapsible Content with smooth expand & collapse animation */}
          <AnimatePresence initial={false}>
            {showBiometricTimesheet && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden pt-4"
              >
                <div className="overflow-x-auto max-h-[430px] overflow-y-auto rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 shadow-sm">
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">{t('attendance.date', 'Date')}</th>
                        <th className="py-2.5 px-3">{t('attendance.day', 'Day')}</th>
                        <th className="py-2.5 px-3">{t('attendance.checkIn', 'Check-In')}</th>
                        <th className="py-2.5 px-3">{t('attendance.checkOut', 'Check-Out')}</th>
                        <th className="py-2.5 px-3">{t('attendance.workingHours', 'Working Hours')}</th>
                        <th className="py-2.5 px-3">{t('attendance.biometricVerification', 'Biometric Verification')}</th>
                        <th className="py-2.5 px-3">{t('attendance.payslipStatus', 'Payslip Status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {Array.from({ length: totalDays }, (_, i) => {
                        const day = i + 1;
                        const dateStr = formatDate(year, month, day);
                        const displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                        const beforeJoiningDay = Boolean(joiningDate && dateStr < joiningDate);
                        const status = displayStatuses.get(dateStr) || 'present';
                        const bio = biometricMap.get(dateStr);
                        const dObj = new Date(year, month - 1, day);
                        const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });

                        if (beforeJoiningDay) return null;

                        return (
                          <tr key={dateStr} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-neutral-900 dark:text-white">{displayDate}</td>
                            <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 font-medium">{dayName}</td>
                            <td className="py-2.5 px-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {bio?.check_in ? `🟢 ${bio.check_in}` : <span className="text-neutral-400">—</span>}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-rose-600 dark:text-rose-400">
                              {bio?.check_out ? `🔴 ${bio.check_out}` : <span className="text-neutral-400">—</span>}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-neutral-800 dark:text-neutral-200">
                              {bio?.duration_hours !== null && bio?.duration_hours !== undefined ? (
                                `⏱️ ${bio.duration_hours} hrs`
                              ) : (
                                <span className="text-neutral-400 font-normal">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {bio?.is_late ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  ⚡ Late Punch
                                </span>
                              ) : bio?.check_in ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  ✓ On-Time ({bio.distance_meters ? `${bio.distance_meters}m` : 'Office'})
                                </span>
                              ) : (
                                <span className="text-neutral-400 font-normal">No Punch</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                status === 'leave' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                                status === 'half_day' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                                status === 'permission' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                status === 'weekoff' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' :
                                status === 'weekoff_halfday' ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' :
                                status === 'company_week_off' ? 'bg-slate-200 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300' :
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}>
                                {status.replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      )}

      {/* Month-wise Leave & Salary Summary Report */}
      {canViewReports && <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        {notJoinedCount > 0 && (
          <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {notJoinedCount} employee(s) joined after {getMonthName(month)} {year} and are excluded from this month's attendance and salary summary.
          </div>
        )}
        <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition-colors ${isReportOpen ? 'pb-3 border-b border-neutral-100 dark:border-neutral-800' : ''}`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                {t('attendance.leaveSummary', 'Leave Summary')} — {monthNames[month - 1]} {year}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {totalEmployeesCount} {t('attendance.totalEmployees', 'Employees')}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="break-words font-bold text-neutral-900 dark:text-white text-sm">{s.employee_name}</p>
                              {s.is_joining_month && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  Joined {s.date_of_joining}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.employee_code}</p>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] uppercase font-bold tracking-wider text-neutral-400">Net Payable</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{s.net_payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {s.is_joining_month && (
                              <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                Prorated ({s.total_days}/{totalDays}d)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg bg-white dark:bg-neutral-800 p-2 border border-neutral-100 dark:border-neutral-700/60">
                            <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Eligible Days</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">
                              {s.total_days} {s.is_joining_month ? `/${totalDays}d` : ''}
                            </span>
                          </div>
                          <div className="rounded-lg bg-white dark:bg-neutral-800 p-2 border border-neutral-100 dark:border-neutral-700/60">
                            <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Present</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">{s.present_days}</span>
                          </div>
                          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 border border-blue-100 dark:border-blue-900/60">
                            <span className="block text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">Weekoff</span>
                            <span className="font-bold text-blue-800 dark:text-blue-300">{s.weekoff_days}</span>
                          </div>
                          <div className="rounded-lg bg-teal-50 dark:bg-teal-950/40 p-2 border border-teal-100 dark:border-teal-900/60">
                            <span className="block text-[10px] text-teal-600 dark:text-teal-400 uppercase font-semibold">Weekoff Half</span>
                            <span className="font-bold text-teal-800 dark:text-teal-300">{s.weekoff_halfday_days || 0}/2</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2 border border-slate-100 dark:border-slate-700/60">
                            <span className="block text-[10px] text-slate-600 dark:text-slate-400 uppercase font-semibold">Company Off</span>
                            <span className="font-bold text-slate-800 dark:text-slate-300">{s.company_week_off_days || 0}</span>
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
                            <span className="block text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold">Permission (Max {permissionAllowance} Free)</span>
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
                          <th className="py-3.5 px-4 text-left text-neutral-700 dark:text-neutral-200">{t('attendance.employee', 'Employee')}</th>
                          <th className="py-3.5 px-4 text-left text-neutral-700 dark:text-neutral-200">{t('employees.employeeCode', 'Code')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Eligible Days</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.present', 'Present')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.weekoff', 'Weekoff')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">Wkoff Half</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.companyOff', 'Company Off')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.leave', 'Leave')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.halfDay', 'Half Day')}</th>
                          <th className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200">{t('attendance.permission', 'Permission')}</th>
                          <th className="py-3.5 px-4 text-right text-neutral-700 dark:text-neutral-200">{t('attendance.totalDeductions', 'Deduction')}</th>
                          <th className="py-3.5 px-4 text-right text-neutral-700 dark:text-neutral-200">{t('attendance.netPayable', 'Net Payable')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 bg-white/40 dark:bg-neutral-900/40 text-sm">
                        {filteredSummary.map((s) => (
                          <tr
                            key={s.employee_id}
                            className={`transition-colors hover:bg-neutral-100/60 dark:hover:bg-neutral-800/50 ${selectedEmployee === s.employee_id ? 'bg-neutral-100/80 dark:bg-neutral-800/70 font-medium' : ''}`}
                          >
                            <td className="py-3.5 px-4 font-semibold text-neutral-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <span>{s.employee_name}</span>
                                {s.is_joining_month && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title={`Joined on ${s.date_of_joining}`}>
                                    Joined {s.date_of_joining}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-300 font-mono text-xs">
                              {s.employee_code}
                            </td>
                            <td className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200 font-medium">
                              <div>{s.total_days}</div>
                              {s.is_joining_month && (
                                <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">of {totalDays}d</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center text-neutral-700 dark:text-neutral-200 font-medium">
                              {s.present_days}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${s.weekoff_days > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.weekoff_days}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${(s.weekoff_halfday_days || 0) > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.weekoff_halfday_days || 0}
                            </td>
                            <td className={`py-3.5 px-3 text-center font-bold ${(s.company_week_off_days || 0) > 0 ? 'text-slate-600 dark:text-slate-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                              {s.company_week_off_days || 0}
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
                              <div>
                                ₹{s.net_payable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {s.is_joining_month && (
                                <span className="block text-[10px] font-normal text-amber-600 dark:text-amber-400">
                                  Prorated ({s.total_days}/{totalDays}d)
                                </span>
                              )}
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
                          <td className="py-3.5 px-3 text-center text-sm font-extrabold text-teal-600 dark:text-teal-400">
                            {totalWeekoffHalfSum}
                          </td>
                          <td className="py-3.5 px-3 text-center text-sm font-extrabold text-slate-600 dark:text-slate-400">
                            {totalCompanyWeekOffSum}
                          </td>
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
                  No attendance records found for {getMonthName(month)} {year}.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>}
    </motion.div>
  );
}
