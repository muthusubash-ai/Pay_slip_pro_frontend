import { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Bell, Search, X, Users, FileText, CreditCard, ChevronRight, Calendar, Settings, Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { employeeService } from '../../services/employeeService';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee, SalarySlip } from '../../types';
import { AllActivityModal } from './AllActivityModal';
import {
  getNotificationOverrides,
  formatTimeAgo,
  setNotificationsRead,
  hasUnreadItems,
} from '../../utils/notificationStorage';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/attendance': 'Attendance',
  '/salary-slips': 'Salary Slips',
  '/settings/company': 'Settings',
  '/profile': 'Profile',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'Dashboard';
}

/* ─── Search Overlay ─── */
function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setEmployees([]);
      setSlips([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const [empRes, slipRes] = await Promise.all([
          employeeService.list({ search: query, per_page: 5 }),
          salarySlipService.list({ per_page: 5 }),
        ]);
        setEmployees(empRes.data.items);
        // Filter slips client-side by employee name
        const filteredSlips = slipRes.data.items.filter(
          (s) => s.employee?.full_name?.toLowerCase().includes(query.toLowerCase())
        );
        setSlips(filteredSlips.slice(0, 3));
      } catch {
        setEmployees([]);
        setSlips([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const location = useLocation();
  const isAddEmployeePage = location.pathname === '/employees/new';
  const isEmployeeDetailPage = /^\/employees\/\d+(\/edit)?$/.test(location.pathname);
  const isGenerateSlipsPage = location.pathname === '/salary-slips/generate';
  const isNavigationLocked = isAddEmployeePage || isEmployeeDetailPage || isGenerateSlipsPage;

  const goTo = (path: string) => {
    if (isNavigationLocked) {
      if ((isAddEmployeePage || isEmployeeDetailPage) && path !== '/employees') {
        return;
      }
      if (isGenerateSlipsPage && path !== '/salary-slips') {
        return;
      }
    }
    navigate(path);
    onClose();
  };

  const quickLinks = [
    { label: 'Dashboard', icon: Search, path: '/dashboard' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Salary Slips', icon: FileText, path: '/salary-slips' },
    { label: 'Attendance', icon: Calendar, path: '/attendance' },
    { label: 'Settings', icon: Settings, path: '/settings/company' },
  ].filter((l) => {
    if (isNavigationLocked) {
      if (isAddEmployeePage) return l.path === '/employees';
      if (isGenerateSlipsPage) return l.path === '/salary-slips';
    }
    return true;
  });

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="fixed left-3 right-3 top-[10%] z-50 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 sm:left-1/2 sm:right-auto sm:top-[15%] sm:w-full sm:max-w-lg sm:-translate-x-1/2"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
          <Search className="h-4 w-4 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees, salary slips..."
            className="flex-1 text-sm outline-none placeholder:text-neutral-300 text-neutral-900"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-neutral-300 hover:text-neutral-600 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] font-medium text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-5 py-6 text-center">
              <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 rounded-full mx-auto animate-spin" />
              <p className="text-xs text-neutral-400 mt-2">Searching...</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-3">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">Quick Links</p>
              {quickLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => goTo(link.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors text-left group"
                >
                  <div className="p-1.5 rounded-md bg-neutral-100 group-hover:bg-neutral-200 transition-colors">
                    <link.icon className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                  <span className="text-[13px] font-medium text-neutral-700">{link.label}</span>
                  <ChevronRight className="h-3 w-3 text-neutral-300 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && employees.length === 0 && slips.length === 0 && (
            <div className="px-5 py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-2">
                <Search className="h-4 w-4 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-600">No results found</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Try a different search term</p>
            </div>
          )}

          {!loading && employees.length > 0 && (
            <div className="p-3">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">
                Employees ({employees.length})
              </p>
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => goTo(`/employees/${emp.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-100 flex items-center justify-center text-[10px] font-bold text-neutral-500 group-hover:from-neutral-700 group-hover:to-neutral-600 group-hover:text-white transition-all shrink-0">
                    {emp.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-800 truncate">{emp.full_name}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{emp.employee_code} · {emp.department || 'No dept'}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-neutral-300 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {!loading && slips.length > 0 && (
            <div className="p-3 border-t border-neutral-50">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-1.5">
                Salary Slips ({slips.length})
              </p>
              {slips.map((slip) => (
                <button
                  key={slip.id}
                  onClick={() => goTo(`/salary-slips/${slip.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors text-left group"
                >
                  <div className="p-1.5 rounded-md bg-neutral-100 group-hover:bg-neutral-200 transition-colors shrink-0">
                    <FileText className="h-3.5 w-3.5 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-800 truncate">
                      {slip.employee?.full_name || 'Employee'}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {MONTH_SHORT[slip.month - 1]} {slip.year} · ₹{slip.net_pay.toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    slip.status === 'sent' ? 'bg-emerald-50 text-emerald-600'
                    : slip.status === 'generated' ? 'bg-sky-50 text-sky-600'
                    : 'bg-neutral-100 text-neutral-500'
                  }`}>
                    {slip.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ─── Notification Dropdown ─── */
interface NotificationDropdownProps {
  onClose: () => void;
  onViewAllActivity: () => void;
}

function NotificationDropdown({ onClose, onViewAllActivity }: NotificationDropdownProps) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState(() => getNotificationOverrides());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    const handleUpdate = () => {
      setOverrides(getNotificationOverrides());
    };
    window.addEventListener('notifications_updated', handleUpdate);
    return () => window.removeEventListener('notifications_updated', handleUpdate);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [empRes, slipRes] = await Promise.all([
          employeeService.list({ per_page: 6 }),
          salarySlipService.list({ per_page: 6 }),
        ]);
        setEmployees(empRes.data.items || []);
        setSlips(slipRes.data.items || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  interface NotificationItem {
    id: string;
    icon: typeof FileText;
    title: string;
    desc: string;
    time: string;
    timestamp: number;
    color: string;
    path: string;
  }

  const notifications: NotificationItem[] = [];

  // Generate notifications from recent slips
  slips.forEach((slip) => {
    const id = `slip-${slip.id}`;
    const ov = overrides[id];
    if (ov?.dismissed) return;

    const slipDate = slip.emailed_at || slip.generated_at;
    const timestamp = slipDate ? new Date(slipDate).getTime() : 0;
    const defaultTitle = slip.status === 'sent' ? 'Salary slip emailed' : 'Salary slip generated';
    const defaultDesc = `${slip.employee?.full_name || 'Employee'} — ${MONTH_SHORT[(slip.month || 1) - 1]} ${slip.year}`;

    notifications.push({
      id,
      icon: FileText,
      title: ov?.title || defaultTitle,
      desc: ov?.desc || defaultDesc,
      time: formatTimeAgo(slipDate),
      timestamp,
      color: slip.status === 'sent' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' : 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
      path: `/salary-slips/${slip.id}`,
    });
  });

  // Generate notifications from recent employees
  employees.forEach((emp) => {
    const id = `emp-${emp.id}`;
    const ov = overrides[id];
    if (ov?.dismissed) return;

    const empDate = emp.created_at || emp.date_of_joining;
    const timestamp = empDate ? new Date(empDate).getTime() : 0;
    const defaultTitle = 'Employee added';
    const defaultDesc = `${emp.full_name} — ${emp.department || emp.designation || 'Staff'}`;

    notifications.push({
      id,
      icon: Users,
      title: ov?.title || defaultTitle,
      desc: ov?.desc || defaultDesc,
      time: formatTimeAgo(empDate),
      timestamp,
      color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
      path: `/employees/${emp.id}`,
    });
  });

  // Generate notification for plan expiry / expiring soon
  if (user && user.plan !== 'starter' && user.plan_expires_at) {
    const expiryTime = new Date(user.plan_expires_at).getTime();
    const diffMs = expiryTime - Date.now();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    const expiryFormatted = new Date(user.plan_expires_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const expiryTimeFormatted = new Date(user.plan_expires_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (diffMs <= 0) {
      const id = `plan-expired-${user.plan}`;
      const ov = overrides[id];
      if (!ov?.dismissed) {
        notifications.unshift({
          id,
          icon: CreditCard,
          title: ov?.title || `${user.plan.toUpperCase()} Plan Expired`,
          desc: ov?.desc || `Your plan expired on ${expiryFormatted} at ${expiryTimeFormatted}. Renew now to unfreeze all features.`,
          time: 'Expired',
          timestamp: Date.now() + 1000000,
          color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
          path: '/settings',
        });
      }
    } else if (diffMs <= 24 * 60 * 60 * 1000) {
      // Final day: Less than 24 hours left - show remaining hours
      const id = `plan-expiring-${user.plan}`;
      const ov = overrides[id];
      if (!ov?.dismissed) {
        const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}!`;
        const defaultDesc = `Your plan expires today at ${expiryTimeFormatted}. Renew now to avoid work interruption.`;
        notifications.unshift({
          id,
          icon: CreditCard,
          title: ov?.title || defaultTitle,
          desc: ov?.desc || defaultDesc,
          time: `${hoursLeft}h left`,
          timestamp: Date.now() + 500000,
          color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
          path: '/settings',
        });
      }
    } else if (diffMs <= 48 * 60 * 60 * 1000) {
      // 1 day before expiry
      const id = `plan-expiring-${user.plan}`;
      const ov = overrides[id];
      if (!ov?.dismissed) {
        const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring Tomorrow (1 day left)!`;
        const defaultDesc = `Your plan expires tomorrow, ${expiryFormatted} at ${expiryTimeFormatted}. Renew early to avoid work interruption.`;
        notifications.unshift({
          id,
          icon: CreditCard,
          title: ov?.title || defaultTitle,
          desc: ov?.desc || defaultDesc,
          time: '1d left',
          timestamp: Date.now() + 500000,
          color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
          path: '/settings',
        });
      }
    } else if (daysLeft <= 7) {
      const id = `plan-expiring-${user.plan}`;
      const ov = overrides[id];
      if (!ov?.dismissed) {
        const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring Soon (${daysLeft}d left)`;
        const defaultDesc = `Your plan expires on ${expiryFormatted} at ${expiryTimeFormatted}. Renew early to avoid work interruption.`;
        notifications.unshift({
          id,
          icon: CreditCard,
          title: ov?.title || defaultTitle,
          desc: ov?.desc || defaultDesc,
          time: `${daysLeft}d left`,
          timestamp: Date.now() + 500000,
          color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
          path: '/settings',
        });
      }
    }
  }

  // Sort by most recent
  notifications.sort((a, b) => b.timestamp - a.timestamp);
  const displayNotifications = notifications.slice(0, 6);

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="fixed left-3 right-3 top-16 z-50 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl shadow-black/10 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <h3 className="text-[13px] font-bold text-neutral-900 dark:text-white">Notifications</h3>
        <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
          {displayNotifications.length}
        </span>
      </div>

      {/* List */}
      <div className="max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-200 rounded-full mx-auto animate-spin" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="h-5 w-5 text-neutral-300 dark:text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">No notifications yet</p>
          </div>
        ) : (
          displayNotifications.map((notif, i) => (
            <motion.button
              key={notif.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => goTo(notif.path)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-left border-b border-neutral-50 dark:border-neutral-800/60 last:border-0"
            >
              <div className={`p-1.5 rounded-lg ${notif.color} shrink-0 mt-0.5`}>
                <notif.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-100">{notif.title}</p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-400 truncate">{notif.desc}</p>
              </div>
              <span className="text-[10px] text-neutral-400 shrink-0 mt-0.5">{notif.time}</span>
            </motion.button>
          ))
        )}
      </div>

      {/* Footer */}
      {displayNotifications.length > 0 && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 py-2.5">
          <button
            onClick={onViewAllActivity}
            className="text-[11px] font-semibold text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white transition-colors flex items-center gap-1 mx-auto"
          >
            View all activity <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════ HEADER ═══════════ */
export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const checkUnread = useCallback(async () => {
    try {
      const [empRes, slipRes] = await Promise.all([
        employeeService.list({ per_page: 1 }),
        salarySlipService.list({ per_page: 1 }),
      ]);
      const latestEmp = empRes.data.items?.[0];
      const latestSlip = slipRes.data.items?.[0];

      const empTime = latestEmp ? new Date(latestEmp.created_at || latestEmp.date_of_joining).getTime() : 0;
      const slipTime = latestSlip ? new Date(latestSlip.emailed_at || latestSlip.generated_at).getTime() : 0;

      let latestPlanAlertTime = 0;
      if (user?.plan && user.plan !== 'starter' && user.plan_expires_at) {
        const diffMs = new Date(user.plan_expires_at).getTime() - Date.now();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffMs <= 0 || daysLeft <= 7) {
          latestPlanAlertTime = Date.now();
        }
      }

      const maxTime = Math.max(empTime, slipTime, latestPlanAlertTime);

      setHasUnread(hasUnreadItems(maxTime));
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    checkUnread();
    const handleReadUpdate = () => {
      checkUnread();
    };
    window.addEventListener('notifications_read_updated', handleReadUpdate);
    window.addEventListener('focus', checkUnread);
    return () => {
      window.removeEventListener('notifications_read_updated', handleReadUpdate);
      window.removeEventListener('focus', checkUnread);
    };
  }, [checkUnread]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const closeSearch = useCallback(() => setShowSearch(false), []);
  const closeNotifications = useCallback(() => setShowNotifications(false), []);

  const pageTitle = getPageTitle(location.pathname);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-100 bg-white px-2.5 sm:h-16 sm:px-5 lg:px-7"
      >
        {/* Left — Page title */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-sm font-bold tracking-tight text-neutral-900 min-[380px]:text-base sm:text-lg">{pageTitle}</h1>
        </div>

        {/* Right — Actions */}
        <div className="flex shrink-0 items-center sm:gap-2">
          {/* Search Bar */}
          <button
            onClick={() => setShowSearch(true)}
            className="hidden min-[360px]:flex items-center gap-2.5 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-900/90 px-3.5 py-1.5 text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-200 transition-all w-48 sm:w-64 md:w-80 shadow-sm"
            title="Search employees, salary slips, etc."
          >
            <Search className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
            <span className="text-xs text-neutral-400 dark:text-neutral-400 font-normal truncate">
              Search employees, slips...
            </span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications((v) => {
                  const next = !v;
                  if (next) {
                    setNotificationsRead();
                    setHasUnread(false);
                  }
                  return next;
                });
              }}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors relative"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {hasUnread && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full"
                />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <NotificationDropdown
                  onClose={closeNotifications}
                  onViewAllActivity={() => {
                    setShowNotifications(false);
                    setShowActivityModal(true);
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle (Light / Dark) */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-neutral-600" />
            )}
          </motion.button>

          {/* Divider */}
          <div className="hidden w-px h-6 bg-neutral-100 mx-1 sm:block" />

          {/* Logout */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="p-2 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.header>

      {/* Search Overlay (portal-like, rendered outside header) */}
      <AnimatePresence>
        {showSearch && <SearchOverlay onClose={closeSearch} />}
      </AnimatePresence>

      {/* Centered Activity & Notifications Modal */}
      <AnimatePresence>
        {showActivityModal && (
          <AllActivityModal onClose={() => setShowActivityModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
