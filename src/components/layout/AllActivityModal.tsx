import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Bell,
  Search,
  Users,
  FileText,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../../services/employeeService';
import { salarySlipService } from '../../services/salarySlipService';
import type { Employee, SalarySlip } from '../../types';
import {
  getNotificationOverrides,
  saveNotificationOverride,
  resetNotificationOverride,
  dismissNotification,
  clearAllNotificationOverrides,
  formatTimeAgo,
  setNotificationsRead,
} from '../../utils/notificationStorage';

export interface ActivityItem {
  id: string;
  type: 'slip' | 'employee';
  rawId: number;
  title: string;
  defaultTitle: string;
  desc: string;
  defaultDesc: string;
  note?: string;
  time: string;
  timestamp: number;
  color: string;
  iconBg: string;
  path: string;
  editPath: string;
  isEdited: boolean;
}

interface AllActivityModalProps {
  onClose: () => void;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AllActivityModal({ onClose }: AllActivityModalProps) {
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'slips' | 'employees'>('all');
  const [overrides, setOverrides] = useState(() => getNotificationOverrides());

  // Editing state for an item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editNote, setEditNote] = useState('');
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, onClose]);

  // Sync overrides on event
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
        title: ov?.title || defaultTitle,
        defaultTitle,
        desc: ov?.desc || defaultDesc,
        defaultDesc,
        note: ov?.note,
        time: formatTimeAgo(slipDate),
        timestamp,
        color: slip.status === 'sent' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400',
        iconBg: slip.status === 'sent' ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-sky-50 dark:bg-sky-950/50',
        path: `/salary-slips/${slip.id}`,
        editPath: `/salary-slips/${slip.id}`,
        isEdited: Boolean(ov?.title || ov?.desc || ov?.note),
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
        title: ov?.title || defaultTitle,
        defaultTitle,
        desc: ov?.desc || defaultDesc,
        defaultDesc,
        note: ov?.note,
        time: formatTimeAgo(empDate),
        timestamp,
        color: 'text-violet-600 dark:text-violet-400',
        iconBg: 'bg-violet-50 dark:bg-violet-950/50',
        path: `/employees/${emp.id}`,
        editPath: `/employees/${emp.id}/edit`,
        isEdited: Boolean(ov?.title || ov?.desc || ov?.note),
      });
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  }, [slips, employees, overrides]);

  // Filter & Search
  const filteredActivities = useMemo(() => {
    return allActivities.filter((item) => {
      if (activeFilter === 'slips' && item.type !== 'slip') return false;
      if (activeFilter === 'employees' && item.type !== 'employee') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        (item.note && item.note.toLowerCase().includes(q))
      );
    });
  }, [allActivities, activeFilter, searchQuery]);

  // Start editing an item
  const handleStartEdit = (item: ActivityItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.desc);
    setEditNote(item.note || '');
  };

  // Save changes
  const handleSaveEdit = (id: string) => {
    saveNotificationOverride(id, {
      title: editTitle.trim(),
      desc: editDesc.trim(),
      note: editNote.trim() || undefined,
    });
    setEditingId(null);
    setSaveSuccessId(id);
    setTimeout(() => setSaveSuccessId(null), 2500);
  };

  // Reset an item to default
  const handleResetItem = (id: string) => {
    resetNotificationOverride(id);
    setEditingId(null);
  };

  // Dismiss an item
  const handleDismiss = (id: string) => {
    dismissNotification(id);
    if (editingId === id) setEditingId(null);
  };

  const hasAnyOverrides = Object.keys(overrides).length > 0;

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
                View all system events, manage notifications, and edit custom titles or notes.
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
              placeholder="Search activity by name, description, or notes..."
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
              {filteredActivities.map((item) => {
                const isEditing = editingId === item.id;
                const isSaved = saveSuccessId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-colors ${
                      isEditing
                        ? 'border-neutral-900 dark:border-neutral-300 bg-neutral-50/80 dark:bg-neutral-800/80 shadow-md ring-2 ring-neutral-900/10 dark:ring-white/10'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                    } p-4`}
                  >
                  {!isEditing ? (
                    /* Regular View Mode */
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${item.iconBg} ${item.color}`}>
                          {item.type === 'slip' ? <FileText className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                              {item.title}
                            </h4>
                            {item.isEdited && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> Customized
                              </span>
                            )}
                            {isSaved && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                Saved ✓
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{item.desc}</p>

                          {item.note && (
                            <div className="mt-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 inline-block max-w-full">
                              <span className="font-semibold text-neutral-900 dark:text-white">Note: </span>
                              {item.note}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                            {item.time && <span>{item.time}</span>}
                            <span>•</span>
                            <span className="capitalize">{item.type === 'slip' ? 'Salary Slip' : 'Employee'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0 pt-1">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-colors"
                          title="Edit this notification"
                        >
                          <Pencil className="h-3 w-3 text-neutral-500" />
                          Edit
                        </button>

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
                  ) : (
                    /* Inline Editing Mode */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <Pencil className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
                          <span className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                            Edit Notification Content
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 mb-1">
                            Notification Title
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Enter notification title..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 mb-1">
                            Description / Subtitle
                          </label>
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Enter description details..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 mb-1">
                            Personal Remark / Note (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Add your own custom notes or reminders for this notification..."
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:border-black dark:focus:border-white resize-none"
                          />
                        </div>
                      </div>

                      {/* Edit Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 text-white hover:bg-black dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-xs font-semibold shadow-sm transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Save Changes
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors"
                          >
                            Cancel
                          </button>

                          {item.isEdited && (
                            <button
                              type="button"
                              onClick={() => handleResetItem(item.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 text-xs font-medium transition-colors"
                              title="Revert back to system default text"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset to Default
                            </button>
                          )}
                        </div>

                        {/* Direct link to edit underlying record */}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(item.editPath);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white underline underline-offset-4"
                        >
                          {item.type === 'employee' ? 'Edit Full Employee Profile' : 'Edit Salary Slip'}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Click any item to view details</span>
            {hasAnyOverrides && (
              <>
                <span>•</span>
                <button
                  onClick={clearAllNotificationOverrides}
                  className="text-neutral-500 hover:text-rose-600 text-xs underline underline-offset-2 transition-colors"
                >
                  Clear all customizations
                </button>
              </>
            )}
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
