import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, Settings, Building2, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getPlan, hasMinimumPlan, type Plan } from '../../lib/plans';

const navItems: Array<{ to: string; label: string; icon: typeof LayoutDashboard; minimumPlan: Plan }> = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minimumPlan: 'starter' },
  { to: '/employees', label: 'Employees', icon: Users, minimumPlan: 'starter' },
  { to: '/attendance', label: 'Attendance', icon: CalendarDays, minimumPlan: 'professional' },
  { to: '/salary-slips', label: 'Salary Slips', icon: FileText, minimumPlan: 'starter' },
  { to: '/settings', label: 'Settings', icon: Settings, minimumPlan: 'starter' },
  { to: '/settings/company', label: 'Company Settings', icon: Building2, minimumPlan: 'professional' },
];

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const plan = getPlan(user);
  const initials = (user?.full_name || user?.email || 'U')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isAddEmployeePage = location.pathname === '/employees/new';
  const isEmployeeDetailPage = /^\/employees\/\d+(\/edit)?$/.test(location.pathname);
  const isGenerateSlipsPage = location.pathname === '/salary-slips/generate';
  const isNavigationLocked = isAddEmployeePage || isEmployeeDetailPage || isGenerateSlipsPage;

  const visibleItems = navItems.filter((item) => hasMinimumPlan(user, item.minimumPlan));
  if (plan === 'enterprise' && user?.role === 'admin') {
    visibleItems.push(
      { to: '/admin', label: 'Admin Overview', icon: ShieldCheck, minimumPlan: 'enterprise' },
      { to: '/admin/users', label: 'User Management', icon: Users, minimumPlan: 'enterprise' },
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onMobileClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/45 transition-opacity lg:hidden',
          isMobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r transition-transform duration-200 lg:static lg:z-auto lg:min-h-screen lg:translate-x-0 lg:transition-[width] lg:duration-300",
        isDark ? "bg-[#0d0d10] border-white/[0.08] text-white" : "bg-white border-neutral-200/90 text-neutral-800 shadow-sm",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "lg:w-[72px]" : "lg:w-[260px]"
      )}>
      {/* Logo / Header */}
      <div className="pt-7 pb-8 px-4">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shadow-md shrink-0",
              isDark ? "bg-white text-black keep-white shadow-white/5" : "bg-black text-white shadow-black/10"
            )}>
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <h1 className={cn("text-[15px] font-bold tracking-tight whitespace-nowrap", isDark ? "text-white" : "text-neutral-900")}>
                Pay Slip Pro
              </h1>
              <p className={cn("text-[10px] tracking-wide whitespace-nowrap", isDark ? "text-neutral-400" : "text-neutral-500")}>
                Salary Management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className={cn(
              "rounded-lg p-2 transition-colors",
              isDark ? "text-neutral-400 hover:bg-white/[0.08] hover:text-white" : "text-neutral-400 hover:bg-neutral-100 hover:text-black"
            )}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isCollapsed ? (
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shadow-md shrink-0",
                isDark ? "bg-white text-black keep-white shadow-white/5" : "bg-black text-white shadow-black/10"
              )}>
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <h1 className={cn("text-[15px] font-bold tracking-tight whitespace-nowrap", isDark ? "text-white" : "text-neutral-900")}>
                  Pay Slip Pro
                </h1>
                <p className={cn("text-[10px] tracking-wide whitespace-nowrap", isDark ? "text-neutral-400" : "text-neutral-500")}>
                  Salary Management
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className={cn(
                "hidden p-1.5 rounded-lg transition-all duration-200 shrink-0 border border-transparent lg:block",
                isDark ? "text-neutral-400 hover:text-white hover:bg-white/[0.08] hover:border-white/10" : "text-neutral-400 hover:text-black hover:bg-neutral-100 hover:border-neutral-200"
              )}
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4.5 w-4.5" />
            </button>
          </div>
        ) : (
          <div className="hidden w-full flex-col items-center gap-4 lg:flex">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shadow-md shrink-0",
              isDark ? "bg-white text-black keep-white shadow-white/5" : "bg-black text-white shadow-black/10"
            )}>
              <FileText className="h-4 w-4" />
            </div>
            <button
              onClick={() => setIsCollapsed(false)}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200 shrink-0 border border-transparent",
                isDark ? "text-neutral-400 hover:text-white hover:bg-white/[0.08] hover:border-white/10" : "text-neutral-400 hover:text-black hover:bg-neutral-100 hover:border-neutral-200"
              )}
              title="Open sidebar"
            >
              <PanelLeftOpen className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={cn("h-px mb-4", isDark ? "bg-white/[0.08]" : "bg-neutral-200/80", isCollapsed ? "mx-3" : "mx-5")} />

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
        <p className={cn(
          'text-[10px] font-bold uppercase tracking-widest px-3 mb-2',
          isDark ? 'text-neutral-500' : 'text-neutral-400',
          isCollapsed && 'lg:hidden'
        )}>
          Menu
        </p>

        {visibleItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (!['/dashboard', '/admin', '/settings'].includes(item.to) && location.pathname.startsWith(item.to));

          const isCurrentSection =
            ((isAddEmployeePage || isEmployeeDetailPage) && item.to === '/employees') ||
            (isGenerateSlipsPage && item.to === '/salary-slips');

          const isThisItemBlocked = isNavigationLocked && !isCurrentSection;

          return (
            <NavLink
              key={item.to}
              to={isThisItemBlocked ? '#' : item.to}
              onClick={(e) => {
                if (isThisItemBlocked) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onMobileClose();
              }}
              className={cn(
                "relative block",
                isThisItemBlocked && "opacity-35 cursor-not-allowed select-none"
              )}
              title={
                isThisItemBlocked
                  ? 'Disabled on this page'
                  : isCollapsed
                    ? item.label
                    : undefined
              }
            >
              <motion.div
                whileHover={{ x: isCollapsed ? 0 : 2 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 relative',
                  isCollapsed ? 'gap-3 px-3 py-2.5 lg:justify-center lg:p-2.5' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? isDark
                      ? 'keep-white bg-white text-black shadow-md shadow-white/5 font-semibold'
                      : 'bg-neutral-900 text-white shadow-sm font-semibold'
                    : isDark
                      ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-black'
                )}
              >
                <item.icon className={cn(
                  'h-[18px] w-[18px] shrink-0 transition-colors',
                  isActive 
                    ? isDark ? 'text-black' : 'text-white'
                    : isDark ? 'text-neutral-400' : 'text-neutral-500'
                )} />
                <span className={cn(isCollapsed && 'lg:hidden')}>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full',
                      isDark ? 'bg-black' : 'bg-white',
                      isCollapsed && 'lg:hidden'
                    )}
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer - Profile Badge & Developed by */}
      <div className={cn(
        "pb-5 pt-3 border-t mt-auto",
        isDark ? "border-white/[0.08]" : "border-neutral-200/80",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {/* Profile Badge */}
        <button
          type="button"
          onClick={() => {
            navigate('/settings');
            onMobileClose();
          }}
          className={cn(
            "w-full flex items-center rounded-xl p-2 transition-all duration-200 group text-left",
            isDark ? "hover:bg-white/[0.08]" : "hover:bg-neutral-100",
            isCollapsed ? "justify-center p-2" : "gap-3"
          )}
          title={isCollapsed ? `${user?.full_name || user?.email} (${plan})` : undefined}
        >
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold shadow-md transition-transform group-hover:scale-105",
            isDark ? "keep-white bg-white text-black shadow-white/5" : "bg-neutral-900 text-white shadow-sm"
          )}>
            {initials}
          </div>
          <div className={cn("min-w-0 flex-1 overflow-hidden", isCollapsed && "lg:hidden")}>
            <div className="flex items-center justify-between gap-1.5">
              <p className={cn(
                "truncate text-[13px] font-semibold transition-colors",
                isDark ? "text-white group-hover:text-neutral-200" : "text-neutral-900 group-hover:text-black"
              )}>
                {user?.full_name || user?.email}
              </p>
              <span className={cn(
                "shrink-0 text-[8px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border",
                isDark ? "text-neutral-300 border-white/10 bg-white/[0.05]" : "text-neutral-700 border-neutral-200 bg-neutral-100"
              )}>
                {plan}
              </span>
            </div>
            <p className={cn(
              "truncate text-[10px]",
              isDark ? "text-neutral-400" : "text-neutral-500"
            )}>
              {user?.role === 'admin' ? 'Administrator' : 'HR Manager'}
            </p>
          </div>
        </button>

        {/* Developed by Zigmaa Tech */}
        <div className={cn(
          "mt-3 pt-2 border-t text-center",
          isDark ? "border-white/[0.04]" : "border-neutral-200/60",
          isCollapsed && "lg:hidden"
        )}>
          <p className={cn("text-[10px]", isDark ? "text-neutral-500" : "text-neutral-400")}>
            Developed by{' '}
            <a
              href="https://www.zigmaatech.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="zigmaa-tech-brand inline-block ml-0.5"
            >
              Zigmaa tech
            </a>
          </p>
        </div>
      </div>
    </aside>
    </>
  );
}
