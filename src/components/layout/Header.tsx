import { useState, useEffect, useRef, useCallback } from 'react';
import { LogOut, Bell, Search, X, Users, FileText, ChevronRight, Calendar, Settings, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { employeeService } from '../../services/employeeService';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee, SalarySlip } from '../../types';

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

  const goTo = (path: string) => {
    navigate(path);
    onClose();
  };

  const quickLinks = [
    { label: 'Dashboard', icon: Search, path: '/dashboard' },
    { label: 'Employees', icon: Users, path: '/employees' },
    { label: 'Salary Slips', icon: FileText, path: '/salary-slips' },
    { label: 'Attendance', icon: Calendar, path: '/attendance' },
    { label: 'Settings', icon: Settings, path: '/settings/company' },
  ];

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
function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    async function load() {
      try {
        const [empRes, slipRes] = await Promise.all([
          employeeService.list({ per_page: 3 }),
          salarySlipService.list({ per_page: 5 }),
        ]);
        setEmployees(empRes.data.items);
        setSlips(slipRes.data.items);
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
    // Delay to prevent the click that opened it from immediately closing
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
    color: string;
    path: string;
  }

  const notifications: NotificationItem[] = [];

  // Generate notifications from recent slips
  slips.forEach((slip) => {
    if (slip.status === 'generated') {
      notifications.push({
        id: `slip-${slip.id}`,
        icon: FileText,
        title: 'Salary slip generated',
        desc: `${slip.employee?.full_name || 'Employee'} — ${MONTH_SHORT[slip.month - 1]} ${slip.year}`,
        time: formatTimeAgo(slip.generated_at),
        color: 'bg-sky-100 text-sky-600',
        path: `/salary-slips/${slip.id}`,
      });
    } else if (slip.status === 'sent') {
      notifications.push({
        id: `slip-sent-${slip.id}`,
        icon: FileText,
        title: 'Salary slip emailed',
        desc: `${slip.employee?.full_name || 'Employee'} — ${MONTH_SHORT[slip.month - 1]} ${slip.year}`,
        time: formatTimeAgo(slip.emailed_at || slip.generated_at),
        color: 'bg-emerald-100 text-emerald-600',
        path: `/salary-slips/${slip.id}`,
      });
    }
  });

  // Generate notifications from recent employees
  employees.forEach((emp) => {
    notifications.push({
      id: `emp-${emp.id}`,
      icon: Users,
      title: 'Employee added',
      desc: `${emp.full_name} — ${emp.department || 'No dept'}`,
      time: formatTimeAgo(emp.created_at),
      color: 'bg-violet-100 text-violet-600',
      path: `/employees/${emp.id}`,
    });
  });

  // Sort by most recent
  notifications.sort((a, b) => b.time.localeCompare(a.time));
  const displayNotifications = notifications.slice(0, 6);

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="fixed left-3 right-3 top-16 z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/8 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <h3 className="text-[13px] font-bold text-neutral-900">Notifications</h3>
        <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
          {displayNotifications.length}
        </span>
      </div>

      {/* List */}
      <div className="max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 rounded-full mx-auto animate-spin" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="h-5 w-5 text-neutral-300 mx-auto mb-2" />
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
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left border-b border-neutral-50 last:border-0"
            >
              <div className={`p-1.5 rounded-lg ${notif.color} shrink-0 mt-0.5`}>
                <notif.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-neutral-800">{notif.title}</p>
                <p className="text-[11px] text-neutral-400 truncate">{notif.desc}</p>
              </div>
              <span className="text-[10px] text-neutral-300 shrink-0 mt-0.5">{notif.time}</span>
            </motion.button>
          ))
        )}
      </div>

      {/* Footer */}
      {displayNotifications.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-2.5">
          <button
            onClick={() => goTo('/salary-slips')}
            className="text-[11px] font-semibold text-neutral-500 hover:text-black transition-colors flex items-center gap-1 mx-auto"
          >
            View all activity <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/* ═══════════ HEADER ═══════════ */
export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
  const initials = (user?.full_name || user?.email || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
          {/* Search */}
          <button
            onClick={() => setShowSearch(true)}
            className="hidden items-center gap-2 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 min-[360px]:flex sm:px-3 sm:py-1.5"
          >
            <Search className="h-4 w-4" />
            <span className="text-[11px] text-neutral-300 hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline text-[10px] font-medium text-neutral-300 bg-neutral-100 px-1.5 py-0.5 rounded ml-1">
              ⌘K
            </kbd>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications((v) => !v);
              }}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors relative"
            >
              <Bell className="h-4 w-4" />
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full"
              />
            </button>

            <AnimatePresence>
              {showNotifications && (
                <NotificationDropdown onClose={closeNotifications} />
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="hidden w-px h-6 bg-neutral-100 mx-1 sm:block" />

          {/* Profile */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-neutral-50 transition-colors group sm:pl-2 sm:pr-3"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-[10px] font-bold text-white sm:h-8 sm:w-8 sm:text-[11px]">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[13px] font-semibold text-neutral-800 leading-tight group-hover:text-black transition-colors">
                {user?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-neutral-400 leading-tight">
                {user?.role === 'admin' ? 'Administrator' : 'HR Manager'}
              </p>
            </div>
          </button>

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
    </>
  );
}
