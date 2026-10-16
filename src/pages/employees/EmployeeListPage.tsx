import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowLeft, ArrowUpZA, ChevronDown, Clock, Plus, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { useEmployees } from '../../hooks/useEmployees';
import type { Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { EMPLOYEE_LIMITS, getPlan } from '../../lib/plans';

export function EmployeeListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'name_asc' | 'name_desc'>('newest');
  const { data, isLoading } = useEmployees(page, search || undefined, undefined, sort);
  const { user } = useAuth();
  const { t } = useTranslation();
  const plan = getPlan(user);
  const employeeLimit = EMPLOYEE_LIMITS[plan];
  const isAtLimit = employeeLimit !== null && (data?.total ?? 0) >= employeeLimit;

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
      <GlassCard>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:border-black dark:focus:border-white outline-none text-sm transition-colors"
              placeholder={t('employees.searchPlaceholder', 'Search employees...')}
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
            title={t('employees.noEmployees', 'No employees yet')}
            description={t('employees.noEmployeesDesc', 'Add your first employee to get started.')}
            action={<Link to="/employees/new"><GradientButton>{t('employees.addEmployee', 'Add Employee')}</GradientButton></Link>}
          />
        ) : (
          <>
            {/* Scrollable container */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
            <AnimatedList>
              {displayedEmployees.map((emp: Employee) => (
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
              ))}
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
    </motion.div>
  );
}
