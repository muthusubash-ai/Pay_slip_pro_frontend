import { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Search,
  Users,
  FileText,
  CreditCard,
  CalendarDays,
  Check,
  Trash2,
  ExternalLink,
  Clock,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { employeeService } from '../../services/employeeService';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee, SalarySlip } from '../../types';
import { listEmployeeLeaveRequests, reviewEmployeeLeaveRequest, type EmployeeLeaveRequest } from '../../services/leaveRequestService';
import {
  getNotificationOverrides,
  dismissNotification,
  formatTimeAgo,
  setNotificationsRead,
} from '../../utils/notificationStorage';

export interface ActivityItem {
  id: string;
  type: 'slip' | 'employee' | 'plan' | 'leave';
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
  initialFilter?: 'all' | 'leaves';
  initialLeaveId?: number | null;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AllActivityModal({ onClose, initialFilter = 'all', initialLeaveId }: AllActivityModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);

  // Synchronously seed from queryClient cache so modal opens with ZERO loading lag
  const cachedLeaves = queryClient.getQueryData<EmployeeLeaveRequest[]>(['employee-leave-requests']) || [];
  const cachedEmpsData = queryClient.getQueryData<{ items: Employee[] }>(['employees']);
  const cachedEmps = cachedEmpsData?.items || [];

  const [selectedLeave, setSelectedLeave] = useState<EmployeeLeaveRequest | null>(() => {
    if (initialLeaveId && cachedLeaves.length > 0) {
      return cachedLeaves.find((l) => l.id === initialLeaveId) || null;
    }
    const urlLeaveId = new URLSearchParams(window.location.search).get('leave_request');
    if (urlLeaveId && cachedLeaves.length > 0) {
      return cachedLeaves.find((l) => l.id === parseInt(urlLeaveId, 10)) || null;
    }
    return null;
  });

  const [employees, setEmployees] = useState<Employee[]>(cachedEmps);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<EmployeeLeaveRequest[]>(cachedLeaves);
  const [leaveActionBusy, setLeaveActionBusy] = useState<number | null>(null);
  const [leaveError, setLeaveError] = useState('');
  const [loading, setLoading] = useState(() => cachedLeaves.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'slips' | 'employees' | 'leaves'>(initialFilter);
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

  // Fetch recent data in background
  useEffect(() => {
    async function loadData() {
      if (cachedLeaves.length === 0) {
        setLoading(true);
      }
      try {
        const [empRes, slipRes] = await Promise.all([
          employeeService.list({ per_page: 30 }),
          salarySlipService.list({ per_page: 30 }),
        ]);
        setEmployees(empRes.data.items || []);
        setSlips(slipRes.data.items || []);
        try {
          const leaves = await listEmployeeLeaveRequests();
          const safeLeaves = Array.isArray(leaves) ? leaves : [];
          setLeaveRequests(safeLeaves);
          if (initialLeaveId && safeLeaves.length > 0) {
            const found = safeLeaves.find((l) => l.id === initialLeaveId);
            if (found) setSelectedLeave(found);
          } else if (!selectedLeave) {
            const urlLeaveId = new URLSearchParams(window.location.search).get('leave_request');
            if (urlLeaveId && safeLeaves.length > 0) {
              const found = safeLeaves.find((l) => l.id === parseInt(urlLeaveId, 10));
              if (found) setSelectedLeave(found);
            }
          }
        } catch (err) {
          console.error('Failed to load leave requests:', err);
        }
      } catch (err) {
        console.error('Failed to load activity items:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [initialLeaveId]);

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

    leaveRequests.forEach((leave) => {
      const id = `leave-${leave.id}`;
      const ov = overrides[id];
      if (ov?.dismissed) return;

      const requestedAt = leave.created_at;

      let leaveMonth = '';
      let leaveYear = '';
      if (leave.start_date) {
        const parts = leave.start_date.split('-');
        if (parts.length >= 2) {
          leaveYear = parts[0];
          leaveMonth = String(parseInt(parts[1], 10));
        }
      }

      const params = new URLSearchParams();
      if (leave.employee_id) params.set('employee_id', String(leave.employee_id));
      if (leave.emp_id) params.set('code', leave.emp_id);
      if (leave.employee_name) params.set('name', leave.employee_name);
      if (leaveMonth) params.set('month', leaveMonth);
      if (leaveYear) params.set('year', leaveYear);
      const leavePath = `/attendance${params.toString() ? `?${params.toString()}` : ''}`;

      items.push({
        id,
        type: 'leave',
        rawId: leave.id,
        title: leave.status === 'PENDING' ? 'Employee leave request' : `Leave request ${leave.status.toLowerCase()}`,
        desc: `${leave.employee_name} (${leave.emp_id}) · ${leave.request_type} · ${leave.start_date}${leave.end_date !== leave.start_date ? ` to ${leave.end_date}` : ''} · ${leave.reason}`,
        time: formatTimeAgo(requestedAt),
        timestamp: requestedAt ? new Date(requestedAt).getTime() : 0,
        color: leave.status === 'PENDING' ? 'text-amber-600 dark:text-amber-400' : leave.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        iconBg: leave.status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/50' : leave.status === 'APPROVED' ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-rose-50 dark:bg-rose-950/50',
        path: leavePath,
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
  }, [slips, employees, leaveRequests, overrides, user]);

  // Filter & Search
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (activeFilter === 'slips' && item.type !== 'slip') return false;
      if (activeFilter === 'employees' && item.type !== 'employee') return false;
      if (activeFilter === 'leaves' && item.type !== 'leave') return false;

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
    setOverrides(getNotificationOverrides());
  };

  const handleLeaveDecision = async (id: number, action: 'APPROVED' | 'REJECTED') => {
    setLeaveActionBusy(id);
    setLeaveError('');
    try {
      await reviewEmployeeLeaveRequest(id, action);
      setLeaveRequests((current) => current.map((leave) => leave.id === id ? { ...leave, status: action } : leave));

      // Invalidate attendance and payroll caches so the UI updates immediately without reload
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-readiness'] }),
        queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['salary-slips'] }),
        queryClient.invalidateQueries({ queryKey: ['salary-slips-for-period'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['payroll-summary'] }),
      ]);

      // Broadcast update event so AttendancePage or any listener updates immediately
      window.dispatchEvent(new CustomEvent('attendance_updated', {
        detail: { leaveRequestId: id, action }
      }));
      window.dispatchEvent(new CustomEvent('notifications_read_updated'));

      // Redirect to employee attendance page on Accept/Reject
      const leave = leaveRequests.find((l) => l.id === id);
      if (leave) {
        let leaveMonth = '';
        let leaveYear = '';
        if (leave.start_date) {
          const parts = leave.start_date.split('-');
          if (parts.length >= 2) {
            leaveYear = parts[0];
            leaveMonth = String(parseInt(parts[1], 10));
          }
        }
        const params = new URLSearchParams();
        if (leave.employee_id) params.set('employee_id', String(leave.employee_id));
        if (leave.emp_id) params.set('code', leave.emp_id);
        if (leave.employee_name) params.set('name', leave.employee_name);
        if (leaveMonth) params.set('month', leaveMonth);
        if (leaveYear) params.set('year', leaveYear);

        onClose();
        navigate(`/attendance${params.toString() ? `?${params.toString()}` : ''}`);
      }
    } catch {
      setLeaveError('Unable to update this request. Please try again.');
    } finally {
      setLeaveActionBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative w-full h-[620px] max-h-[90vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-[max-width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          selectedLeave ? "max-w-5xl" : "max-w-3xl"
        )}
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
              placeholder={t('header.searchPlaceholder')}
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
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeFilter === 'all'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {t('common.all')} ({allActivities.length})
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
              {t('salary.title')} ({allActivities.filter((a) => a.type === 'slip').length})
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
              {t('employees.title')} ({allActivities.filter((a) => a.type === 'employee').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('leaves')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === 'leaves'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {t('attendance.leaveRequests')} ({allActivities.filter((a) => a.type === 'leave').length})
            </button>
          </div>
        </div>

        {/* Two-Panel Body Layout: Left is Activity List (smoothly shifts left), Right is Employee Details (smoothly slides in) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left panel: Activity List (Smooth CSS transition) */}
          <div
            className={cn(
              "overflow-y-auto p-3.5 sm:p-5 shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              selectedLeave ? "hidden md:block md:w-[42%] border-r border-neutral-200 dark:border-neutral-800" : "w-full"
            )}
          >
            {leaveError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{leaveError}</p>}
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-800 dark:border-neutral-700 dark:border-t-white rounded-full mx-auto animate-spin mb-3" />
                <p className="text-xs text-neutral-400">{t('common.loading')}</p>
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
                {filteredActivities.map((item) => {
                  const isSelectedLeave = item.type === 'leave' && selectedLeave?.id === item.rawId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'leave') {
                          const found = leaveRequests.find((leave) => leave.id === item.rawId);
                          if (found) setSelectedLeave(found);
                        }
                      }}
                      className={cn(
                        "rounded-xl border transition-all duration-200 cursor-pointer",
                        selectedLeave ? "p-3" : "p-3.5 sm:p-4",
                        isSelectedLeave
                          ? "border-emerald-500 bg-emerald-50/25 dark:bg-emerald-950/25 ring-2 ring-emerald-500/60 shadow-sm"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${item.iconBg} ${item.color}`}>
                            {item.type === 'plan' ? (
                              <CreditCard className="h-3.5 w-3.5" />
                            ) : item.type === 'slip' ? (
                              <FileText className="h-3.5 w-3.5" />
                            ) : item.type === 'leave' ? (
                              <CalendarDays className="h-3.5 w-3.5" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 justify-between">
                              <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                                {item.title}
                              </h4>
                              {item.time && (
                                <span className="text-[10px] text-neutral-400 shrink-0 font-medium">
                                  {item.time}
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 line-clamp-1">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        {selectedLeave ? (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === 'leave') {
                                  const found = leaveRequests.find((leave) => leave.id === item.rawId);
                                  if (found) {
                                    setSelectedLeave(found);
                                    return;
                                  }
                                }
                                onClose();
                                navigate(item.path);
                              }}
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer",
                                isSelectedLeave
                                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-xs"
                                  : "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100"
                              )}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismiss(item.id)}
                              className="p-1 rounded text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                            {item.type === 'leave' && leaveRequests.find((leave) => leave.id === item.rawId)?.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  disabled={leaveActionBusy === item.rawId}
                                  onClick={() => void handleLeaveDecision(item.rawId, 'APPROVED')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40 cursor-pointer"
                                  title="Approve & Redirect to Attendance"
                                >
                                  <Check className="h-3 w-3" /> Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={leaveActionBusy === item.rawId}
                                  onClick={() => void handleLeaveDecision(item.rawId, 'REJECTED')}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                                  title="Reject & Redirect to Attendance"
                                >
                                  <X className="h-3 w-3" /> Reject
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === 'leave') {
                                  const found = leaveRequests.find((leave) => leave.id === item.rawId);
                                  if (found) {
                                    setSelectedLeave(found);
                                    return;
                                  }
                                }
                                onClose();
                                navigate(item.path);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                              title={t('common.details')}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {t('common.view')}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDismiss(item.id)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>

          {/* Right panel: Employee Leave Details Frame (Fast GPU slide, popLayout per item) */}
          <AnimatePresence>
            {selectedLeave && (
              <motion.div
                initial={{ opacity: 0, x: 26 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 26 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 flex flex-col bg-neutral-50/70 dark:bg-neutral-900/80 overflow-hidden border-t md:border-t-0"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 sticky top-0 backdrop-blur-sm z-10 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedLeave(null)}
                      className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                      title="Back to list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                        Leave Request Details
                      </h4>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Ref #{selectedLeave.id}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLeave(null)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Close details view"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Animated Item Content (Smooth slide on next view click without lag) */}
                <div className="flex-1 overflow-y-auto relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={selectedLeave.id}
                      initial={{ opacity: 0, x: 22 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="p-5 space-y-4 text-xs"
                    >
                      {/* Status Banner */}
                      <div className={cn(
                        "flex items-center justify-between p-3 rounded-xl border",
                        selectedLeave.status === 'APPROVED'
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                          : selectedLeave.status === 'REJECTED'
                          ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
                          : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300"
                      )}>
                        <div className="flex items-center gap-2">
                          {selectedLeave.status === 'APPROVED' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : selectedLeave.status === 'REJECTED' ? (
                            <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold text-[11px] uppercase tracking-wider">
                              Status: {selectedLeave.status}
                            </p>
                            <p className="text-[10px] opacity-80">
                              {selectedLeave.status === 'APPROVED'
                                ? 'Approved by HR — attendance calendar updated'
                                : selectedLeave.status === 'REJECTED'
                                ? 'Rejected by HR'
                                : 'Awaiting HR review and decision'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-neutral-900/80 border border-current shrink-0">
                          {selectedLeave.request_type}
                        </span>
                      </div>

                      {/* Employee Info Card */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                          Employee Information
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                            {(selectedLeave.employee_name || 'EM').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-neutral-900 dark:text-white text-sm truncate">
                              {selectedLeave.employee_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono font-semibold text-neutral-600 dark:text-neutral-300">
                                {selectedLeave.emp_id || 'ID N/A'}
                              </span>
                              {(() => {
                                const emp = employees.find((e) => e.id === selectedLeave.employee_id);
                                return emp?.department || emp?.designation ? (
                                  <span className="text-[11px] text-neutral-400">
                                    {emp.department || emp.designation}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timing & Dates Card */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2.5">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Date & Schedule
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
                            <span className="text-[10px] text-neutral-400 block font-medium">Date</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-100">
                              {selectedLeave.start_date === selectedLeave.end_date
                                ? selectedLeave.start_date
                                : `${selectedLeave.start_date} → ${selectedLeave.end_date}`}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800">
                            <span className="text-[10px] text-neutral-400 block font-medium">Type / Duration</span>
                            <span className="font-bold text-neutral-800 dark:text-neutral-100">
                              {selectedLeave.request_type === 'PERMISSION'
                                ? `${selectedLeave.duration_hours || 2} Hours`
                                : selectedLeave.request_type === 'HALF_DAY'
                                ? 'Half Day (0.5)'
                                : 'Full Day Leave'}
                            </span>
                          </div>
                        </div>

                        {selectedLeave.from_time && selectedLeave.to_time && (
                          <div className="p-2.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                              <Clock className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Permission Time Window:</span>
                            </div>
                            <span className="font-mono font-bold text-neutral-900 dark:text-white px-2 py-0.5 rounded bg-white dark:bg-neutral-900 shadow-xs">
                              {selectedLeave.from_time} – {selectedLeave.to_time}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Reason Card */}
                      <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                          Employee's Reason
                        </p>
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 italic text-neutral-700 dark:text-neutral-300">
                          "{selectedLeave.reason || 'No reason specified by employee.'}"
                        </div>
                        {selectedLeave.created_at && (
                          <p className="text-[10px] text-neutral-400 mt-2 text-right">
                            Submitted: {new Date(selectedLeave.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Panel Footer Actions */}
                <div className="p-4 border-t border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between gap-2 shrink-0">
                  {selectedLeave.status === 'PENDING' ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        disabled={leaveActionBusy === selectedLeave.id}
                        onClick={() => void handleLeaveDecision(selectedLeave.id, 'APPROVED')}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Accept & View Attendance
                      </button>
                      <button
                        type="button"
                        disabled={leaveActionBusy === selectedLeave.id}
                        onClick={() => void handleLeaveDecision(selectedLeave.id, 'REJECTED')}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject & View Attendance
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          let leaveMonth = '';
                          let leaveYear = '';
                          if (selectedLeave.start_date) {
                            const parts = selectedLeave.start_date.split('-');
                            if (parts.length >= 2) {
                              leaveYear = parts[0];
                              leaveMonth = String(parseInt(parts[1], 10));
                            }
                          }
                          const params = new URLSearchParams();
                          if (selectedLeave.employee_id) params.set('employee_id', String(selectedLeave.employee_id));
                          if (selectedLeave.emp_id) params.set('code', selectedLeave.emp_id);
                          if (selectedLeave.employee_name) params.set('name', selectedLeave.employee_name);
                          if (leaveMonth) params.set('month', leaveMonth);
                          if (leaveYear) params.set('year', leaveYear);
                          onClose();
                          navigate(`/attendance${params.toString() ? `?${params.toString()}` : ''}`);
                        }}
                        className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        Open Attendance Calendar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedLeave(null)}
                        className="py-2 px-3 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Close Details
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span>Click any item to view details</span>
            {allActivities.some((item) => item.type === 'leave') && activeFilter === 'leaves' && (
              <button
                type="button"
                onClick={() => {
                  allActivities.filter((item) => item.type === 'leave').forEach((item) => {
                    dismissNotification(item.id);
                  });
                  setOverrides(getNotificationOverrides());
                }}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <Trash2 className="h-3 w-3" /> Clear all leave notifications
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
