import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, Settings, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { getPlan, hasMinimumPlan, type Plan } from '../../lib/plans';

const navItems: Array<{ to: string; label: string; icon: typeof LayoutDashboard; minimumPlan: Plan }> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minimumPlan: 'starter' },
  { to: '/employees', label: 'Employees', icon: Users, minimumPlan: 'starter' },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays, minimumPlan: 'professional' },
  { to: '/salary-slips', label: 'Salary Slips', icon: FileText, minimumPlan: 'starter' },
  { to: '/settings/company', label: 'Company Settings', icon: Settings, minimumPlan: 'professional' },
];

export function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const plan = getPlan(user);
  const visibleItems = navItems.filter((item) => hasMinimumPlan(user, item.minimumPlan));
  if (plan === 'enterprise' && user?.role === 'admin') {
    visibleItems.push(
      { to: '/admin', label: 'Admin Overview', icon: ShieldCheck, minimumPlan: 'enterprise' },
      { to: '/admin/users', label: 'User Management', icon: Users, minimumPlan: 'enterprise' },
    );
  }

  return (
    <aside className={cn(
      "bg-neutral-950 min-h-screen flex flex-col border-r border-white/[0.06] transition-all duration-300",
      isCollapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* Logo / Header */}
      <div className="pt-7 pb-8 px-4">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-white/5 shrink-0">
                <FileText className="h-4 w-4 text-black" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-[15px] font-bold text-white tracking-tight whitespace-nowrap">Pay Slip Pro</h1>
                <p className="text-[10px] text-neutral-500 tracking-wide whitespace-nowrap">Salary Management</p>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all duration-200 shrink-0 border border-transparent hover:border-white/10"
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4.5 w-4.5" />
            </button>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-white/5 shrink-0">
              <FileText className="h-4 w-4 text-black" />
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-all duration-200 shrink-0 border border-transparent hover:border-white/10"
              title="Open sidebar"
            >
              <PanelLeftOpen className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={cn("h-px bg-white/[0.06] mb-4", isCollapsed ? "mx-3" : "mx-5")} />

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        {!isCollapsed && (
          <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest px-3 mb-2">
            Menu
          </p>
        )}
        {visibleItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (!['/dashboard', '/admin'].includes(item.to) && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative block"
              title={isCollapsed ? item.label : undefined}
            >
              <motion.div
                whileHover={{ x: isCollapsed ? 0 : 2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 relative',
                  isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-white text-black shadow-md shadow-white/5'
                    : 'text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200'
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-black' : '')} />
                {!isCollapsed && <span>{item.label}</span>}
                {isActive && !isCollapsed && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-black rounded-r-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn("pb-6 pt-4", isCollapsed ? "px-2" : "px-5")}>
        <div className="h-px bg-white/[0.06] mb-4" />
        <div className={cn("flex items-center gap-2", isCollapsed ? "justify-center" : "px-1")}>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          {!isCollapsed && (
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] text-neutral-500">System Online</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-300 border border-white/10 rounded px-1.5 py-0.5">
                {plan}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
