import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowDownAZ, ArrowLeft, ArrowUpZA, Check, ChevronDown, Clock, Plus, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { useEmployees, useReactivateEmployee, usePermanentDeleteEmployee } from '../../hooks/useEmployees';
import type { Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { EMPLOYEE_LIMITS, getPlan } from '../../lib/plans';

export function EmployeeListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'name_asc' | 'name_desc'>('newest');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const { data, isLoading } = useEmployees(page, search || undefined, undefined, sort, undefined, statusFilter);
  const reactivateMutation = useReactivateEmployee();
  const permanentDeleteMutation = usePermanentDeleteEmployee();
  const [reactivateTarget, setReactivateTarget] = useState<Employee | null>(null);
  const [reactivateEmail, setReactivateEmail] = useState('');
  const [reactivateError, setReactivateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const { user } = useAuth();
  const { t } = useTranslation();
  const plan = getPlan(user);
  const employeeLimit = EMPLOYEE_LIMITS[plan];
  const isAtLimit = employeeLimit !== null && (data?.active_count ?? data?.total ?? 0) >= employeeLimit;

  const openReactivateModal = (emp: Employee) => {
    let initialEmail = emp.email || '';
    if (initialEmail.startsWith('deactivated_')) {
      const parts = initialEmail.split('_');
      initialEmail = parts.slice(2).join('_');
    }
    setReactivateTarget(emp);
    setReactivateEmail(initialEmail);
    setReactivateError('');
  };

  const handleConfirmReactivate = async () => {
    if (!reactivateTarget) return;
    const emailToUse = reactivateEmail.trim();
    if (!emailToUse) {
      setReactivateError('Please enter a valid email address.');
      return;
    }
    try {
      await reactivateMutation.mutateAsync({ id: reactivateTarget.id, email: emailToUse });
      setSuccessToast(`Employee ${reactivateTarget.full_name} (${reactivateTarget.employee_code}) reactivated successfully!`);
      setReactivateTarget(null);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.email || err.message || 'Failed to reactivate employee.';
      setReactivateError(String(msg));
    }
  };

  const DEACTIVATED_RETENTION_DAYS = 30;
  const daysUntilPurge = (deactivatedAt?: string | null) => {
    if (!deactivatedAt) return null;
    const deactivatedMs = new Date(deactivatedAt).getTime();
    if (Number.isNaN(deactivatedMs)) return null;
    const elapsedDays = (Date.now() - deactivatedMs) / (1000 * 60 * 60 * 24);
    return Math.max(0, Math.ceil(DEACTIVATED_RETENTION_DAYS - elapsedDays));
  };

  const openDeleteModal = (emp: Employee) => {
    setDeleteTarget(emp);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toUpperCase() !== deleteTarget.employee_code.toUpperCase()) {
      setDeleteError(`Type "${deleteTarget.employee_code}" exactly to confirm.`);
      return;
    }
    try {
      await permanentDeleteMutation.mutateAsync(deleteTarget.id);
      setSuccessToast(`Employee ${deleteTarget.full_name} (${deleteTarget.employee_code}) and all of their records were permanently deleted.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessToast(''), 5000);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to permanently delete employee.';
      setDeleteError(String(msg));
    }
  };

  const displayedEmployees = useMemo(() => {
    if (!data?.items) return [];
    const items = [...data.items];
    if (sort === 'name_asc') {
      return items.sort((a, b) => a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }));
    }
    if (sort === 'name_desc') {
      return items.sort((a, b) => b.full_name.localeCompare(a.full_name, undefined, { sensitivity: 'base' }));
    }
    return items;
  }, [data?.items, sort]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Back to dashboard" title="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white sm:text-2xl">{t('employees.title', 'Employees')}</h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {data?.total ?? 0} {t('common.of', 'of')} {employeeLimit ?? t('common.unlimited', 'unlimited')} {t('employees.title', 'employees').toLowerCase()} · {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
          </p>
        </div>
        {isAtLimit ? (
          <GradientButton className="w-full sm:w-auto" disabled title={`The ${plan} plan supports up to ${employeeLimit} employees`}>
            {t('employees.limitReached', 'Employee Limit Reached')}
          </GradientButton>
        ) : (
          <Link to="/employees/new" className="w-full sm:w-auto">
            <GradientButton className="w-full sm:w-auto">
              <span className="inline-flex items-center justify-center gap-2">
                <Plus className="h-4 w-4 shrink-0" />
                <span>{t('employees.addEmployee', 'Add Employee')}</span>
              </span>
            </GradientButton>
          </Link>
        )}
      </div>
      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      <GlassCard>
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 mb-4 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 w-fit">
          <button
            type="button"
            onClick={() => { setStatusFilter('active'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'active'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <span>Active Employees</span>
            {data?.active_count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'active'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}>
                {data.active_count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setStatusFilter('inactive'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'inactive'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            <span>Deactivated</span>
            {data?.inactive_count !== undefined && data.inactive_count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                statusFilter === 'inactive'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {data.inactive_count}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:border-black dark:focus:border-white outline-none text-sm transition-colors"
              placeholder={statusFilter === 'inactive' ? 'Search deactivated employees...' : t('employees.searchPlaceholder', 'Search employees...')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          {/* Alphabetical & Default Sort Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as 'newest' | 'name_asc' | 'name_desc');
                  setPage(1);
                }}
                className="h-10.5 pl-9 pr-9 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:border-black dark:focus:border-white outline-none text-sm font-medium transition-colors cursor-pointer appearance-none shadow-sm"
                aria-label="Sort employees"
              >
                <option value="newest" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {t('employees.sortNewest', 'Newest First')}
                </option>
                <option value="name_asc" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {t('employees.sortAZ', 'Alphabetical (A → Z)')}
                </option>
                <option value="name_desc" className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  {t('employees.sortZA', 'Alphabetical (Z → A)')}
                </option>
              </select>
              {sort === 'name_asc' ? (
                <ArrowDownAZ className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-800 dark:text-neutral-200 pointer-events-none" />
              ) : sort === 'name_desc' ? (
                <ArrowUpZA className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-800 dark:text-neutral-200 pointer-events-none" />
              ) : (
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
            </div>

            {/* Quick 1-click A-Z / Z-A toggle button */}
            <button
              type="button"
              onClick={() => {
                setSort((prev) => (prev === 'name_asc' ? 'name_desc' : prev === 'name_desc' ? 'newest' : 'name_asc'));
                setPage(1);
              }}
              title={
                sort === 'name_asc'
                  ? 'Switch to Z → A'
                  : sort === 'name_desc'
                  ? 'Reset to Newest First'
                  : 'Sort Alphabetically (A → Z)'
              }
              className={`h-10.5 px-3 rounded-xl border-2 flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                sort.startsWith('name')
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              {sort === 'name_asc' ? (
                <>
                  <ArrowDownAZ className="h-4 w-4 shrink-0" />
                  <span>A → Z</span>
                </>
              ) : sort === 'name_desc' ? (
                <>
                  <ArrowUpZA className="h-4 w-4 shrink-0" />
                  <span>Z → A</span>
                </>
              ) : (
                <>
                  <ArrowDownAZ className="h-4 w-4 shrink-0 text-neutral-400" />
                  <span>A-Z</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : !data?.items?.length ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title={statusFilter === 'inactive' ? 'No deactivated employees' : t('employees.noEmployees', 'No employees yet')}
            description={statusFilter === 'inactive' ? 'Deactivated employees will appear here and can be reactivated anytime.' : t('employees.noEmployeesDesc', 'Add your first employee to get started.')}
            action={statusFilter === 'active' ? <Link to="/employees/new"><GradientButton>{t('employees.addEmployee', 'Add Employee')}</GradientButton></Link> : undefined}
          />
        ) : (
          <>
            {/* Scrollable container */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
            <AnimatedList>
              {displayedEmployees.map((emp: Employee) => {
                const cleanEmail = emp.email?.startsWith('deactivated_')
                  ? emp.email.split('_').slice(2).join('_')
                  : emp.email;

                if (!emp.is_active) {
                  const remainingDays = daysUntilPurge(emp.deactivated_at);
                  return (
                    <div
                      key={emp.id}
                      className="p-4 rounded-xl border border-dashed border-amber-300/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 transition-colors"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-neutral-900 dark:text-white line-through opacity-75">{emp.full_name}</p>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Deactivated
                            </span>
                            {remainingDays !== null && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                {remainingDays > 0
                                  ? `Auto-deletes in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`
                                  : 'Auto-delete pending'}
                              </span>
                            )}
                          </div>
                          <p className="break-words text-sm text-neutral-500 dark:text-neutral-400">
                            {emp.employee_code} · {emp.designation || 'No designation'} · {emp.department || 'No department'}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 sm:justify-end">
                          <div className="min-w-0 text-left sm:text-right hidden sm:block">
                            <p className="font-semibold text-neutral-700 dark:text-neutral-300 text-sm">₹{emp.basic_salary.toLocaleString()}</p>
                            <p className="break-all text-xs text-neutral-400">{cleanEmail || 'No email'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openReactivateModal(emp)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reactivate</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(emp)}
                              title="Permanently delete this employee and all of their records"
                              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Permanently</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={emp.id}
                    to={`/employees/${emp.id}`}
                    className="block p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900 dark:text-white">{emp.full_name}</p>
                        <p className="break-words text-sm text-neutral-500 dark:text-neutral-400">{emp.employee_code} · {emp.designation || 'No designation'} · {emp.department || 'No department'}</p>
                      </div>
                      <div className="min-w-0 text-left sm:text-right">
                        <p className="font-semibold text-neutral-900 dark:text-white">₹{emp.basic_salary.toLocaleString()}</p>
                        <p className="break-all text-sm text-neutral-500 dark:text-neutral-400">{emp.email}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </AnimatedList>
            </div>

            {data.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 text-sm text-neutral-700 dark:text-neutral-300"
                >
                  {t('common.previous', 'Previous')}
                </button>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Page {page} of {data.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-50 text-sm text-neutral-700 dark:text-neutral-300"
                >
                  {t('common.next', 'Next')}
                </button>
              </div>
            )}
          </>
        )}
      </GlassCard>

      {/* Reactivate Confirmation Modal */}
      {reactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Reactivate Employee
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {reactivateTarget.full_name} ({reactivateTarget.employee_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReactivateTarget(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              This will restore this employee to your active employee roster, enabling salary slip generation and attendance tracking.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Employee Email Address *
              </label>
              <input
                type="email"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:border-emerald-500"
                placeholder="Enter employee email"
                value={reactivateEmail}
                onChange={(e) => {
                  setReactivateEmail(e.target.value);
                  setReactivateError('');
                }}
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Make sure this email is unique and not used by another active employee.
              </p>
              {reactivateError && (
                <p className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{reactivateError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReactivateTarget(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reactivateMutation.isPending || !reactivateEmail.trim()}
                onClick={handleConfirmReactivate}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {reactivateMutation.isPending ? (
                  <span>Reactivating...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Reactivate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Permanently Delete Employee
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {deleteTarget.full_name} ({deleteTarget.employee_code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-2.5 leading-relaxed font-medium">
              This cannot be undone. It permanently deletes this employee along with all of their salary slips, attendance history, and leave requests - immediately, without waiting for the 30-day auto-delete.
            </p>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Type <span className="font-mono font-bold">{deleteTarget.employee_code}</span> to confirm *
              </label>
              <input
                type="text"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:border-rose-500"
                placeholder={deleteTarget.employee_code}
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError('');
                }}
              />
              {deleteError && (
                <p className="mt-2 text-xs text-red-500 font-medium flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 p-2 rounded-lg border border-red-200 dark:border-red-900">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={permanentDeleteMutation.isPending || deleteConfirmText.trim().toUpperCase() !== deleteTarget.employee_code.toUpperCase()}
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {permanentDeleteMutation.isPending ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
