import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Plus, FileText, Trash2, Calendar, Filter, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { GradientButton } from '../../components/ui/GradientButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AnimatedList } from '../../components/ui/AnimatedList';
import { useSalarySlips, useDeleteSlip } from '../../hooks/useSalarySlips';
import type { SalarySlip } from '../../types';

const MONTH_NAMES = [
  'All Months',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = [2024, 2025, 2026, 2027];

export function SalarySlipListPage() {
  const location = useLocation();
  const stateMonth = (location.state as { month?: number })?.month;
  const stateYear = (location.state as { year?: number })?.year;

  const [month, setMonth] = useState<number>(stateMonth ?? 0);
  const [year, setYear] = useState<number>(stateYear ?? 0);
  const [page, setPage] = useState(1);

  // Sync state if navigated with state from GenerateSlipsPage
  useEffect(() => {
    if (stateMonth !== undefined && stateMonth !== month) {
      setMonth(stateMonth);
      setPage(1);
    }
    if (stateYear !== undefined && stateYear !== year) {
      setYear(stateYear);
      setPage(1);
    }
  }, [stateMonth, stateYear]);

  const { data, isLoading } = useSalarySlips(page, month, year);
  const deleteSlip = useDeleteSlip();

  const handleMonthChange = (newMonth: number) => {
    setMonth(newMonth);
    setPage(1);
  };

  const handleYearChange = (newYear: number) => {
    setYear(newYear);
    setPage(1);
  };

  const handleResetFilters = () => {
    setMonth(0);
    setYear(0);
    setPage(1);
  };

  const handleDelete = (e: React.MouseEvent, slipId: number, empName: string) => {
    e.preventDefault(); // Prevent navigating to detail page
    e.stopPropagation();
    if (window.confirm(`Delete salary slip for ${empName}? This cannot be undone.`)) {
      deleteSlip.mutate(slipId);
    }
  };

  const isFiltering = month > 0 || year > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl flex items-center gap-2">
            <FileText className="h-6 w-6 text-neutral-800 dark:text-neutral-200" /> Salary Slips
          </h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
            Manage, filter, and inspect generated salary slips for your employees
          </p>
        </div>
        <Link to="/salary-slips/generate" className="w-full sm:w-auto">
          <GradientButton className="w-full sm:w-auto">
            <span className="inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              <span>Generate Slips</span>
            </span>
          </GradientButton>
        </Link>
      </div>

      {/* Month & Year Filters Card (Identical to Attendance filter design) */}
      <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {/* Month Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                Month
              </label>
              <select
                value={month}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 mb-1.5 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />
                Year
              </label>
              <select
                value={year}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-black dark:focus:border-white transition-colors text-sm font-medium"
              >
                <option value={0} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                  All Years
                </option>
                {YEARS.map((y) => (
                  <option key={y} value={y} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action & Filter Summary */}
          <div className="flex items-center gap-3 pt-1 sm:pt-0">
            {isFiltering && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm"
                title="Reset month and year filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <span className="text-xs px-3 py-2 rounded-xl font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
              {data?.total ?? 0} {data?.total === 1 ? 'Slip' : 'Slips'}
              {isFiltering ? ` (${month > 0 ? MONTH_NAMES[month] : ''} ${year > 0 ? year : ''})`.trim() : ''}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Salary Slips List */}
      <GlassCard className="dark:bg-neutral-900/90 dark:border-neutral-800">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : !data?.items?.length ? (
          <EmptyState
            icon={<FileText className="h-12 w-12 text-neutral-400" />}
            title={isFiltering ? 'No salary slips found' : 'No salary slips yet'}
            description={
              isFiltering
                ? `No salary slips found for ${month > 0 ? MONTH_NAMES[month] : ''} ${year > 0 ? year : ''}. Try selecting another period or generate slips.`
                : 'Generate salary slips for your employees.'
            }
            action={
              isFiltering ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    View All Slips
                  </button>
                  <Link to="/salary-slips/generate">
                    <GradientButton>Generate Slips</GradientButton>
                  </Link>
                </div>
              ) : (
                <Link to="/salary-slips/generate">
                  <GradientButton>Generate Slips</GradientButton>
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="max-h-[65vh] overflow-y-auto pr-1">
              <AnimatedList>
                {data.items.map((slip: SalarySlip) => (
                  <Link
                    key={slip.id}
                    to={`/salary-slips/${slip.id}`}
                    className="block p-4 rounded-xl border border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors mb-2 last:mb-0"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {slip.employee?.full_name || `Employee #${slip.employee_id}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {MONTH_NAMES[slip.month]} {slip.year}
                          </span>{' '}
                          · Code: {slip.employee?.employee_code || '—'}
                          {slip.leave_deduction && Number(slip.leave_deduction) > 0 ? (
                            <span className="ml-2 text-rose-600 dark:text-rose-400 font-medium">
                              (Leave Ded: ₹{Number(slip.leave_deduction).toLocaleString()})
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                            ₹{slip.net_pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <span
                            className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              slip.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : slip.status === 'generated'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                            }`}
                          >
                            {slip.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, slip.id, slip.employee?.full_name || 'Unknown')}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete salary slip"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </AnimatedList>
            </div>

            {data.pages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-gray-600 dark:text-neutral-400 px-2">
                  Page {page} of {data.pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </motion.div>
  );
}
