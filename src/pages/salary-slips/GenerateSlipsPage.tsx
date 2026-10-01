import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useGenerateSlips, useGenerateSingleSlip } from '../../hooks/useSalarySlips';
import { useEmployees } from '../../hooks/useEmployees';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useAttendanceReadiness } from '../../hooks/useAttendance';
import { hasMinimumPlan } from '../../lib/plans';

export function GenerateSlipsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const generateSlips = useGenerateSlips();
  const generateSingleSlip = useGenerateSingleSlip();
  const { data: empData, isLoading: empLoading } = useEmployees(1, undefined, undefined);
  const { data: readiness, isLoading: readinessLoading, isError: readinessError } = useAttendanceReadiness(month, year);

  // Fetch existing slips for selected month & year to enforce one-slip-per-month rule
  const { data: existingSlipsRes } = useQuery({
    queryKey: ['salary-slips-for-period', month, year],
    queryFn: () => salarySlipService.list({ month, year, per_page: 500 }).then((r) => r.data),
    enabled: !!user,
  });

  const existingSlips = existingSlipsRes?.items || [];
  const employees: Employee[] = empData?.items || [];
  const canGenerateBulk = hasMinimumPlan(user, 'professional');
  const isAllSelected = canGenerateBulk && (selectedEmployee === 'all' || selectedEmployee === '');
  const selectedEmp = isAllSelected ? undefined : employees.find((e) => e.id === Number(selectedEmployee));
  const selectedAttendanceComplete = Boolean(selectedEmp && readiness?.find((item) => item.employee_id === selectedEmp.id)?.complete);

  const monthName = new Date(2000, month - 1).toLocaleString('default', { month: 'long' });

  // Date of Joining validation helper
  const isEmployeePriorToJoining = (emp: Employee, m: number, y: number) => {
    if (!emp.date_of_joining) return false;
    const parts = emp.date_of_joining.split('-').map(Number);
    if (parts.length < 2) return false;
    const jYear = parts[0];
    const jMonth = parts[1];
    return y < jYear || (y === jYear && m < jMonth);
  };

  // Date of Joining validation for currently selected employee
  let isBeforeJoining = false;
  let dojFormatted = '';
  let dojYearNum = 0;
  let dojMonthNum = 0;

  if (selectedEmp?.date_of_joining) {
    const parts = selectedEmp.date_of_joining.split('-').map(Number);
    if (parts.length >= 2) {
      dojYearNum = parts[0];
      dojMonthNum = parts[1];
      const dojMonthName = new Date(2000, dojMonthNum - 1).toLocaleString('default', { month: 'long' });
      dojFormatted = `${dojMonthName} ${dojYearNum}`;

      if (year < dojYearNum || (year === dojYearNum && month < dojMonthNum)) {
        isBeforeJoining = true;
      }
    }
  }

  // Check if selected employee already has a slip generated for this month
  const isSelectedAlreadyGenerated = Boolean(
    selectedEmp &&
      existingSlips.some((s) => s.employee_id === selectedEmp.id || s.employee?.id === selectedEmp.id)
  );

  // Bulk / All employees check
  const eligibleEmployees = employees.filter((emp) => !isEmployeePriorToJoining(emp, month, year));
  const employeesWithExistingSlips = eligibleEmployees.filter((emp) =>
    existingSlips.some((s) => s.employee_id === emp.id || s.employee?.id === emp.id)
  );
  const allAlreadyGenerated = eligibleEmployees.length > 0 && employeesWithExistingSlips.length === eligibleEmployees.length;
  const someAlreadyGenerated = employeesWithExistingSlips.length > 0 && !allAlreadyGenerated;
  const remainingToGenerate = eligibleEmployees.length - employeesWithExistingSlips.length;
  const pendingAttendance = eligibleEmployees.filter((emp) =>
    !existingSlips.some((slip) => slip.employee_id === emp.id || slip.employee?.id === emp.id)
    && !readiness?.find((item) => item.employee_id === emp.id)?.complete
  );
  const readyToGenerate = remainingToGenerate - pendingAttendance.length;

  const handleGenerate = async () => {
    setError('');
    setSuccess('');

    if (readinessLoading || readinessError || !readiness) {
      setError('Attendance status could not be verified. Please retry before generating salary slips.');
      return;
    }

    if (isAllSelected) {
      // Validate all already generated
      if (allAlreadyGenerated) {
        setError(
          `Salary slips for all eligible employees have already been generated for ${monthName} ${year}. A salary slip can only be generated once per month. If you want to re-generate, you must delete the existing salary slip(s) first.`
        );
        return;
      }
      if (readyToGenerate === 0) {
        setError(`Save complete attendance for ${monthName} ${year} before generating salary slips.`);
        return;
      }

      // Generate for all employees
      generateSlips.mutate(
        { month, year },
        {
          onSuccess: (res) => {
            const count = res.data?.generated ?? 0;
            if (count > 0) {
              const pending = (res.data as { attendance_pending_employee_ids?: number[] }).attendance_pending_employee_ids?.length || 0;
              setSuccess(`Generated ${count} salary slip${count !== 1 ? 's' : ''} for ${monthName} ${year}.${pending ? ` ${pending} employee(s) skipped until attendance is saved.` : ''}`);
              setTimeout(() => navigate('/salary-slips', { state: { month, year } }), 1000);
            } else {
              setError(
                res.data?.message || `No salary slips could be generated for ${monthName} ${year}.`
              );
            }
          },
          onError: (err: unknown) => {
            const msg =
              err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                : undefined;
            setError(msg || 'Failed to generate salary slips.');
          },
        }
      );
    } else if (selectedEmp) {
      // Validate date of joining
      if (isBeforeJoining) {
        setError(
          `Cannot generate salary slip for ${monthName} ${year}. Employee ${selectedEmp.full_name} joined on ${selectedEmp.date_of_joining}. Salary slips can only be generated from ${dojFormatted} onwards.`
        );
        return;
      }

      // Validate already generated
      if (isSelectedAlreadyGenerated) {
        setError(
          `Salary slip already exists for ${selectedEmp.full_name} for ${monthName} ${year}. A salary slip can only be generated once per month. If you want to re-generate, you must delete the existing salary slip first.`
        );
        return;
      }
      if (!selectedAttendanceComplete) {
        setError(`Save complete attendance for ${selectedEmp.full_name} for ${monthName} ${year} before generating the salary slip.`);
        return;
      }

      // Generate for single employee
      generateSingleSlip.mutate(
        { employeeId: selectedEmp.id, month, year },
        {
          onSuccess: () => {
            setSuccess(`Generated salary slip for ${selectedEmp.full_name} — ${monthName} ${year}.`);
            setTimeout(() => navigate('/salary-slips', { state: { month, year } }), 1000);
          },
          onError: (err: unknown) => {
            const msg =
              err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
                : undefined;
            setError(msg || 'Failed to generate salary slip.');
          },
        }
      );
    } else {
      setError('Select an employee before generating a salary slip.');
    }
  };

  const isBlocked = isAllSelected
    ? allAlreadyGenerated || eligibleEmployees.length === 0 || readyToGenerate === 0 || readinessLoading || readinessError
    : !selectedEmp || isBeforeJoining || isSelectedAlreadyGenerated || !selectedAttendanceComplete || readinessLoading || readinessError;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/salary-slips" className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="truncate text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">Generate Salary Slips</h2>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 text-red-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800 text-green-700 dark:text-emerald-300 px-4 py-3 rounded-xl text-sm">
          {success}
        </div>
      )}

      <GlassCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5">
              Employee
            </label>
            {empLoading ? (
              <LoadingSpinner />
            ) : (
              <select
                value={canGenerateBulk ? selectedEmployee || 'all' : selectedEmployee === 'all' ? '' : selectedEmployee}
                onChange={(e) => {
                  setSelectedEmployee(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
              >
                {canGenerateBulk ? (
                  <option value="all" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    All Employees ({employees.length})
                  </option>
                ) : (
                  <option value="" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    Select an employee
                  </option>
                )}
                {employees.map((emp) => (
                  <option key={emp.id} value={String(emp.id)} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
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
                setError('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const mNum = i + 1;
                const mName = new Date(2000, i).toLocaleString('default', { month: 'long' });
                const isPriorMonth = Boolean(selectedEmp && dojYearNum && (year < dojYearNum || (year === dojYearNum && mNum < dojMonthNum)));
                return (
                  <option key={mNum} value={mNum} disabled={isPriorMonth} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {mName} {isPriorMonth ? '(Before Joining)' : ''}
                  </option>
                );
              })}
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
                setError('');
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
            >
              {[2024, 2025, 2026, 2027].map((y) => {
                const isPriorYear = Boolean(selectedEmp && dojYearNum && y < dojYearNum);
                return (
                  <option key={y} value={y} disabled={isPriorYear} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {y} {isPriorYear ? '(Before Joining)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Show selected employee details if single employee is chosen */}
        {selectedEmp && (
          <div className="mb-5 p-4 sm:p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-900/90 shadow-sm transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                  {selectedEmp.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-neutral-900 dark:text-white text-base">
                      {selectedEmp.full_name}
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold bg-neutral-200/80 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                      {selectedEmp.employee_code}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                    {selectedEmp.department || 'General'} · {selectedEmp.designation || 'Staff'} · {selectedEmp.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:border-l sm:border-neutral-200 dark:sm:border-neutral-800 sm:pl-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-200 dark:border-neutral-800">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400 block mb-0.5">
                    Date of Joining
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-emerald-400">
                    {selectedEmp.date_of_joining ? `${selectedEmp.date_of_joining} (${dojFormatted})` : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400 block mb-0.5">
                    Basic Salary
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    ₹{Number(selectedEmp.basic_salary || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning 1: Month is Before Date of Joining */}
        {isBeforeJoining && selectedEmp && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Cannot Generate Salary Slip Before Joining Date
              </h4>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                <strong>{selectedEmp.full_name}</strong> joined the company on{' '}
                <strong className="underline underline-offset-2">{selectedEmp.date_of_joining}</strong> ({dojFormatted}).
                Salary slip cannot be generated for months prior to the date of joining.
                Please select <strong>{dojFormatted}</strong> or a subsequent month.
              </p>
            </div>
          </div>
        )}

        {/* Warning 2: Single Employee Already Generated for this Month */}
        {isSelectedAlreadyGenerated && selectedEmp && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Salary Slip Already Generated for this Month
              </h4>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                A salary slip for <strong>{selectedEmp.full_name}</strong> has already been generated for{' '}
                <strong>{monthName} {year}</strong>. A salary slip can only be generated <strong>once per month</strong>.
                If you want to re-generate, you must delete the existing salary slip first.
              </p>
              <div className="mt-2.5">
                <Link
                  to="/salary-slips"
                  className="inline-flex items-center gap-1 text-xs font-bold underline text-amber-950 dark:text-amber-200 hover:opacity-80"
                >
                  ← Go to Salary Slips to Delete Existing Slip
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Warning 3: All Employees Already Generated */}
        {isAllSelected && allAlreadyGenerated && (
          <div className="mb-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Salary Slips Already Generated for All Employees
              </h4>
              <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-1 leading-relaxed">
                Salary slips for <strong>all eligible employees</strong> have already been generated for{' '}
                <strong>{monthName} {year}</strong>. A salary slip can only be generated <strong>once per month</strong> per employee.
                If you want to re-generate, you must delete the existing salary slip(s) first.
              </p>
              <div className="mt-2.5">
                <Link
                  to="/salary-slips"
                  className="inline-flex items-center gap-1 text-xs font-bold underline text-amber-950 dark:text-amber-200 hover:opacity-80"
                >
                  ← Go to Salary Slips to Delete Existing Slips
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Notice 4: Some Employees Already Generated (Partial Bulk) */}
        {isAllSelected && someAlreadyGenerated && (
          <div className="mb-5 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                Partial Slips Already Generated ({employeesWithExistingSlips.length} of {eligibleEmployees.length})
              </h4>
              <p className="text-xs text-blue-900/90 dark:text-blue-300/90 mt-1 leading-relaxed">
                <strong>{employeesWithExistingSlips.length}</strong> employee(s) already have salary slips for{' '}
                <strong>{monthName} {year}</strong>. Generating now will create slips for the remaining{' '}
                <strong>{readyToGenerate}</strong> employee(s) with saved attendance. To re-generate for employees who already have slips, delete their existing slips first.
              </p>
            </div>
          </div>
        )}

        {!readinessLoading && !readinessError && !isBeforeJoining && !isSelectedAlreadyGenerated &&
          (isAllSelected ? pendingAttendance.length > 0 : selectedEmp && !selectedAttendanceComplete) && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Attendance must be saved first</p>
              <p className="mt-1 text-xs">
                {isAllSelected
                  ? `${pendingAttendance.length} employee(s) need complete attendance for ${monthName} ${year}. Only employees with saved attendance can get slips.`
                  : `Save ${selectedEmp?.full_name}'s complete attendance for ${monthName} ${year} before generating the slip.`}
              </p>
              <Link to="/attendance" className="mt-2 inline-block text-xs font-bold underline">Go to Attendance</Link>
            </div>
          </div>
        )}

        {readinessError && <p className="mb-5 text-sm text-red-700">Attendance status could not be loaded. Refresh and try again.</p>}

        <p className="text-neutral-500 dark:text-neutral-400 mb-5 text-xs">
          {isAllSelected
            ? `Generate salary slips for all active employees at once for ${monthName} ${year}.`
            : `Generate salary slip for ${selectedEmp?.full_name || 'the selected employee'} for ${monthName} ${year}.`}
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/salary-slips')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-center"
          >
            ← Back to Salary Slips
          </button>
          <GradientButton
            className="w-full sm:w-auto"
            onClick={handleGenerate}
            disabled={isBlocked || generateSlips.isPending || generateSingleSlip.isPending}
            isLoading={generateSlips.isPending || generateSingleSlip.isPending}
          >
            {isAllSelected
              ? allAlreadyGenerated
                ? 'All Slips Generated (Delete to Re-generate)'
                : pendingAttendance.length > 0 || someAlreadyGenerated
                ? `Generate for Attendance-Ready Employees (${readyToGenerate})`
                : 'Generate All Salary Slips'
              : isBeforeJoining
              ? `Cannot Generate Before Joining Date (${dojFormatted})`
              : isSelectedAlreadyGenerated
              ? 'Already Generated (Delete Slip First)'
              : 'Generate Salary Slip'}
          </GradientButton>
        </div>
      </GlassCard>
    </motion.div>
  );
}
