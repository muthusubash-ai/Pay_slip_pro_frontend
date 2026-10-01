export interface NotificationOverride {
  title?: string;
  desc?: string;
  note?: string;
  dismissed?: boolean;
  updatedAt?: number;
}

const STORAGE_KEY = 'payslip_notification_overrides';
const LAST_READ_KEY = 'payslip_notifications_last_read';

export function getLastReadTimestamp(): number {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function setNotificationsRead() {
  try {
    localStorage.setItem(LAST_READ_KEY, Date.now().toString());
    window.dispatchEvent(new Event('notifications_read_updated'));
  } catch {
    // ignore
  }
}

export function hasUnreadItems(latestTimestamp: number): boolean {
  if (!latestTimestamp) return false;
  const lastRead = getLastReadTimestamp();
  return latestTimestamp > lastRead;
}

export function getNotificationOverrides(): Record<string, NotificationOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveNotificationOverride(id: string, override: Partial<NotificationOverride>) {
  try {
    const all = getNotificationOverrides();
    all[id] = {
      ...all[id],
      ...override,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('notifications_updated', { detail: { id, override } }));
  } catch {
    // ignore
  }
}

export function resetNotificationOverride(id: string) {
  try {
    const all = getNotificationOverrides();
    delete all[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('notifications_updated', { detail: { id } }));
  } catch {
    // ignore
  }
}

export function dismissNotification(id: string) {
  saveNotificationOverride(id, { dismissed: true });
}

export function clearAllNotificationOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('notifications_updated', { detail: {} }));
  } catch {
    // ignore
  }
}

export function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}
