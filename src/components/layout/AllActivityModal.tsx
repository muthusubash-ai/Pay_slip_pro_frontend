import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Bell,
  Search,
  Users,
  FileText,
  CreditCard,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee, SalarySlip } from '../../types';
import {
  getNotificationOverrides,
  dismissNotification,
  formatTimeAgo,
  setNotificationsRead,
} from '../../utils/notificationStorage';

export interface ActivityItem {
  id: string;
  type: 'slip' | 'employee' | 'plan';
  rawId: number;
  title: string;
  desc: string;
  time: string;
  timestamp: number;
  color: string;
  iconBg: string;
  path: string;
}

interface AllActivityModalProps {
  onClose: () => void;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AllActivityModal({ onClose }: AllActivityModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'slips' | 'employees' | 'plans'>('all');
  const [overrides, setOverrides] = useState(() => getNotificationOverrides());

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Sync overrides on event (e.g. dismissal)
  useEffect(() => {
    const handleUpdate = () => {
      setOverrides(getNotificationOverrides());
    };
    window.addEventListener('notifications_updated', handleUpdate);
    return () => window.removeEventListener('notifications_updated', handleUpdate);
  }, []);

  // Mark notifications as read when opening full activity modal
  useEffect(() => {
    setNotificationsRead();
  }, []);

  // Fetch recent data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [empRes, slipRes] = await Promise.all([
          employeeService.list({ per_page: 30 }),
          salarySlipService.list({ per_page: 30 }),
        ]);
        setEmployees(empRes.data.items || []);
        setSlips(slipRes.data.items || []);
      } catch (err) {
        console.error('Failed to load activity items:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Assemble full activity list
  const allActivities = useMemo(() => {
    const items: ActivityItem[] = [];

    // Slips
    slips.forEach((slip) => {
      const id = `slip-${slip.id}`;
      const ov = overrides[id];
      if (ov?.dismissed) return;

      const empName = slip.employee?.full_name || 'Employee';
      const monthStr = MONTH_SHORT[(slip.month || 1) - 1] || '';
      const defaultTitle = slip.status === 'sent' ? 'Salary slip emailed' : 'Salary slip generated';
      const defaultDesc = `${empName} — ${monthStr} ${slip.year}`;
      const slipDate = slip.emailed_at || slip.generated_at;
      const timestamp = slipDate ? new Date(slipDate).getTime() : 0;

      items.push({
        id,
        type: 'slip',
        rawId: slip.id,
        title: defaultTitle,
        desc: defaultDesc,
        time: formatTimeAgo(slipDate),
        timestamp,
        color: slip.status === 'sent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400',
        iconBg: slip.status === 'sent' ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-sky-50 dark:bg-sky-950/50',
        path: `/salary-slips/${slip.id}`,
      });
    });

    // Employees
    employees.forEach((emp) => {
      const id = `emp-${emp.id}`;
      const ov = overrides[id];
      if (ov?.dismissed) return;

      const defaultTitle = 'Employee added';
      const defaultDesc = `${emp.full_name} — ${emp.department || emp.designation || 'Staff'}`;
      const empDate = emp.created_at || emp.date_of_joining;
      const timestamp = empDate ? new Date(empDate).getTime() : 0;

      items.push({
        id,
        type: 'employee',
        rawId: emp.id,
        title: defaultTitle,
        desc: defaultDesc,
        time: formatTimeAgo(empDate),
        timestamp,
        color: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-50 dark:bg-violet-950/50',
        path: `/employees/${emp.id}`,
      });
    });

    // Plan Expiry Alerts
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
          const defaultTitle = `${user.plan.toUpperCase()} Plan Expired`;
          const defaultDesc = `Your subscription expired on ${expiryFormatted} at ${expiryTimeFormatted}. Please renew or upgrade to unfreeze access.`;
          items.push({
            id,
            type: 'plan',
            rawId: 0,
            title: defaultTitle,
            desc: defaultDesc,
            time: 'Expired',
            timestamp: Date.now() + 1000000,
            color: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50',
            path: '/settings',
          });
        }
      } else if (diffMs <= 24 * 60 * 60 * 1000) {
        // Final day: Less than 24 hours left - show hours remaining
        const id = `plan-expiring-${user.plan}`;
        const ov = overrides[id];
        if (!ov?.dismissed) {
          const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}!`;
          const defaultDesc = `Your plan expires today at ${expiryTimeFormatted}. Renew now to prevent service interruption.`;
          items.push({
            id,
            type: 'plan',
            rawId: 0,
            title: defaultTitle,
            desc: defaultDesc,
            time: `Expiring in ${hoursLeft}h`,
            timestamp: Date.now() + 500000,
            color: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50',
            path: '/settings',
          });
        }
      } else if (diffMs <= 48 * 60 * 60 * 1000) {
        // 1 day before expiry
        const id = `plan-expiring-${user.plan}`;
        const ov = overrides[id];
        if (!ov?.dismissed) {
          const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring Tomorrow (1 day left)!`;
          const defaultDesc = `Your plan expires tomorrow, ${expiryFormatted} at ${expiryTimeFormatted}. Renew early to prevent service interruption.`;
          items.push({
            id,
            type: 'plan',
            rawId: 0,
            title: defaultTitle,
            desc: defaultDesc,
            time: '1 day left',
            timestamp: Date.now() + 500000,
            color: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            path: '/settings',
          });
        }
      } else if (daysLeft <= 7) {
        const id = `plan-expiring-${user.plan}`;
        const ov = overrides[id];
        if (!ov?.dismissed) {
          const defaultTitle = `${user.plan.toUpperCase()} Plan Expiring Soon (${daysLeft}d left)`;
          const defaultDesc = `Your plan expires on ${expiryFormatted} at ${expiryTimeFormatted}. Renew early to prevent service interruption.`;
          items.push({
            id,
            type: 'plan',
            rawId: 0,
            title: defaultTitle,
            desc: defaultDesc,
            time: `${daysLeft} days left`,
            timestamp: Date.now() + 500000,
            color: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            path: '/settings',
          });
        }
      }
    }

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [slips, employees, overrides, user]);

  // Filter & Search
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (activeFilter === 'slips' && item.type !== 'slip') return false;
      if (activeFilter === 'employees' && item.type !== 'employee') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
      );
    });
  }, [allActivities, activeFilter, searchQuery]);

  // Dismiss an item
  const handleDismiss = (id: string) => {
    dismissNotification(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-3xl h-[560px] max-h-[88vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Notifications & Activity Center
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {allActivities.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                View all system events and manage notifications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar: Search and Filter Tabs */}
        <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search activity by name or description..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              All ({allActivities.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('slips')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeFilter === 'slips'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <FileText className="h-3 w-3" />
              Slips ({allActivities.filter((a) => a.type === 'slip').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('employees')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeFilter === 'employees'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Users className="h-3 w-3" />
              Employees ({allActivities.filter((a) => a.type === 'employee').length})
            </button>
          </div>
        </div>

        {/* Notification List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 dark:border-neutral-700 dark:border-t-white rounded-full mx-auto animate-spin mb-3" />
              <p className="text-xs text-neutral-400">Loading activity...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                <Bell className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">No activities found</h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No notifications matched "${searchQuery}". Try changing your search query.`
                  : 'There are no active notifications to display in this category.'}
              </p>
            </div>
          ) : (
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
              className="space-y-3"
            >
              {filteredActivities.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${item.iconBg} ${item.color}`}>
                        {item.type === 'plan' ? (
                          <CreditCard className="h-4 w-4" />
                        ) : item.type === 'slip' ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                            {item.title}
                          </h4>
                        </div>

                        <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{item.desc}</p>

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                          {item.time && <span>{item.time}</span>}
                          <span>•</span>
                          <span className="capitalize">
                            {item.type === 'slip'
                              ? 'Salary Slip'
                              : item.type === 'plan'
                              ? 'Subscription'
                              : 'Employee'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: View and Dismiss */}
                    <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0 pt-1">
                      <button
                        onClick={() => {
                          onClose();
                          navigate(item.path);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors"
                        title="View Details"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </button>

                      <button
                        onClick={() => handleDismiss(item.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Dismiss notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Click any item to view details
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
