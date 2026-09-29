import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, ChevronRight, Wallet, Activity } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useDashboardStats, useDepartmentBreakdown, usePayrollSummary } from '../../hooks/useDashboard';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasMinimumPlan } from '../../lib/plans';

/** Custom stacked coins icon */
function CoinsStackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="18" rx="8" ry="3" />
      <path d="M4 18v-2c0 1.66 3.58 3 8 3s8-1.34 8-3v2" />
      <ellipse cx="12" cy="13" rx="8" ry="3" />
      <path d="M4 13v-2c0 1.66 3.58 3 8 3s8-1.34 8-3v2" />
      <ellipse cx="12" cy="8" rx="8" ry="3" />
      <path d="M20 8v2" />
      <path d="M4 8v2" />
    </svg>
  );
}

/* ─── animated number counter ─── */
function AnimatedValue({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(eased * value));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentTime.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentTime.getFullYear());
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewReports = hasMinimumPlan(user, 'professional');
  const isEnterprise = hasMinimumPlan(user, 'enterprise');

  const { data: stats, isLoading } = useDashboardStats();
  const { data: departments } = useDepartmentBreakdown();
  const { data: payroll, isLoading: payrollLoading } = usePayrollSummary(selectedMonth, selectedYear);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  const yearOptions: number[] = [];
  for (let y = currentTime.getFullYear(); y >= currentTime.getFullYear() - 5; y--) {
    yearOptions.push(y);
  }

  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fullName = user?.full_name || 'Admin';

  const formattedDate = `${MONTH_NAMES[currentTime.getMonth()]} ${currentTime.getDate()}, ${currentTime.getFullYear()}`;
  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const cards = [
    { label: 'Total Employees', value: stats?.total_employees ?? 0, icon: Users, trend: '+12%', trendUp: true },
    { label: 'Active Employees', value: stats?.active_employees ?? 0, icon: UserCheck, trend: '+5%', trendUp: true },
    { label: 'Total Payroll', value: stats?.total_payroll ?? 0, icon: CoinsStackIcon, trend: '+8%', trendUp: true, isCurrency: true },
    { label: 'This Month', value: stats?.current_month_salary ?? 0, icon: TrendingUp, trend: '-2%', trendUp: false, isCurrency: true },
  ];

  return (
    <div className="-m-4 min-h-full sm:-m-5 lg:-m-7 lg:h-[calc(100vh-64px)] lg:overflow-hidden">
      <div className="flex min-h-full flex-col gap-5 p-4 sm:p-5 lg:h-full lg:overflow-hidden lg:p-6">

        {/* Welcome bar */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="flex items-start justify-between gap-3 shrink-0"
        >
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
              {greeting}, {fullName}
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <Activity className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
              <span>{formattedDate}</span>
              <span className="text-neutral-300">·</span>
              <span className="font-medium text-neutral-600 font-mono text-[11px]">{formattedTime}</span>
              <span className="text-neutral-300">—</span>
              <span>Dashboard Overview</span>
            </p>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0"
        >
          {cards.map((stat, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.06)' }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl p-4 border border-neutral-100 cursor-default relative overflow-hidden group"
            >
              {/* Subtle hover gradient — neutral only */}
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-neutral-100 group-hover:bg-neutral-200 transition-colors">
                    <stat.icon className="h-4 w-4 text-neutral-600" />
                  </div>
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    stat.trendUp
                      ? 'bg-neutral-100 text-neutral-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}>
                    {stat.trendUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                    {stat.trend}
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                <p className="text-xl font-bold text-neutral-900 tracking-tight">
                  {stat.isCurrency ? (
                    <>₹<AnimatedValue value={stat.value as number} /></>
                  ) : (
                    <AnimatedValue value={stat.value as number} />
                  )}
                </p>
              </div>

              {/* Decorative corner circle — neutral */}
              <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-neutral-200 opacity-15 group-hover:opacity-30 transition-opacity" />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom row: Payroll + Employee table */}
        {canViewReports && (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-5">

          {/* Monthly Payroll — 2 cols */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.12 }}
            className={`${isEnterprise ? 'lg:col-span-2' : 'lg:col-span-5'} bg-white rounded-2xl border border-neutral-100 p-5 flex flex-col`}
          >
            <div className="flex flex-col gap-3 mb-4 shrink-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-neutral-100">
                  <Wallet className="h-3.5 w-3.5 text-neutral-600" />
                </div>
                <h3 className="text-[13px] font-bold text-neutral-900">Monthly Payroll</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border border-neutral-200 rounded-md px-2 py-1 text-[11px] bg-white text-neutral-600 focus:outline-none focus:border-neutral-400 cursor-pointer"
                >
                  {MONTH_SHORT.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="border border-neutral-200 rounded-md px-2 py-1 text-[11px] bg-white text-neutral-600 focus:outline-none focus:border-neutral-400 cursor-pointer"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {payrollLoading ? (
              <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
            ) : payroll && payroll.slip_count > 0 ? (
              <div className="flex-1 flex flex-col gap-2">
                {[
                  { label: 'Slips Generated', value: payroll.slip_count.toString() },
                  { label: 'Gross Salary', value: `₹${payroll.total_gross.toLocaleString()}` },
                  { label: 'Deductions', value: `₹${payroll.total_deductions.toLocaleString()}` },
                  { label: 'Net Pay', value: `₹${payroll.total_net.toLocaleString()}` },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    className="flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 rounded-xl px-4 py-3 flex-1 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-5 rounded-full bg-neutral-300 group-hover:bg-neutral-900 transition-colors" />
                      <span className="text-xs font-medium text-neutral-500 group-hover:text-neutral-700 transition-colors">{item.label}</span>
                    </div>
                    <span className="text-sm font-bold text-neutral-800">{item.value}</span>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-2">
                  <Calendar className="h-4 w-4 text-neutral-400" />
                </div>
                <p className="text-xs text-neutral-500">No slips for {MONTH_SHORT[selectedMonth - 1]} {selectedYear}</p>
              </div>
            )}
          </motion.div>

          {/* Employee Overview — 3 cols */}
          {isEnterprise && (
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="lg:col-span-3 bg-white rounded-2xl border border-neutral-100 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-neutral-100">
                  <Users className="h-3.5 w-3.5 text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-neutral-900">Employee Overview</h3>
                  <p className="text-[10px] text-neutral-400">{departments?.length ?? 0} members</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/employees')}
                className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-800 flex items-center gap-0.5 transition-colors"
              >
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {departments && departments.length > 0 ? (
              <>
              <div className="space-y-2 p-4 md:hidden">
                {departments.slice(0, 6).map((emp, i) => (
                  <motion.button
                    type="button"
                    key={emp.employee_code}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    onClick={() => navigate('/employees')}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 text-left transition-colors hover:bg-neutral-50"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-[10px] font-bold text-neutral-500">
                        {emp.employee_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-neutral-800">{emp.employee_name}</p>
                        <p className="truncate text-[10px] text-neutral-400">{emp.employee_code} · {emp.department}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-neutral-800">₹{emp.basic_salary.toLocaleString()}</span>
                  </motion.button>
                ))}
              </div>
              <div className="hidden flex-1 overflow-auto md:block">
                <table className="w-full min-w-[560px]">
                  <thead className="sticky top-0 bg-neutral-50/90 backdrop-blur-sm z-10">
                    <tr>
                      <th className="text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-5 py-2.5">Employee</th>
                      <th className="text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-5 py-2.5">Department</th>
                      <th className="text-left text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-5 py-2.5 hidden xl:table-cell">Designation</th>
                      <th className="text-right text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-5 py-2.5">Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.slice(0, 6).map((emp, i) => (
                      <motion.tr
                        key={emp.employee_code}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.04 }}
                        className="border-t border-neutral-50 hover:bg-neutral-50/60 transition-colors group cursor-pointer"
                        onClick={() => navigate('/employees')}
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-500 group-hover:bg-neutral-800 group-hover:text-white transition-all duration-200">
                              {emp.employee_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[12px] font-semibold text-neutral-800 leading-tight">{emp.employee_name}</p>
                              <p className="text-[10px] text-neutral-400 leading-tight">{emp.employee_code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md font-medium">
                            {emp.department}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-[12px] text-neutral-500 hidden xl:table-cell">{emp.designation}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className="text-[12px] font-bold text-neutral-800">₹{emp.basic_salary.toLocaleString()}</span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-neutral-600 mb-0.5">No employees yet</p>
                <p className="text-[11px] text-neutral-400 mb-3">Add employees to see the overview</p>
                <button
                  onClick={() => navigate('/employees/new')}
                  className="px-3 py-1.5 bg-neutral-900 text-white text-[11px] font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  Add Employee
                </button>
              </div>
            )}
          </motion.div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
