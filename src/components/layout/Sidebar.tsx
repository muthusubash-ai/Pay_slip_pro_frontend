import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, Settings, Building2, PanelLeftClose, ShieldCheck, X, User, LogOut, ChevronUp, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../context/LanguageContext';
import { getPlan, hasMinimumPlan, type Plan } from '../../lib/plans';

const navItems: Array<{ to: string; label: string; translationKey: string; icon: typeof LayoutDashboard; minimumPlan: Plan }> = [
  { to: '/dashboard', label: 'Dashboard', translationKey: 'nav.dashboard', icon: LayoutDashboard, minimumPlan: 'starter' },
  { to: '/employees', label: 'Employees', translationKey: 'nav.employees', icon: Users, minimumPlan: 'starter' },
  { to: '/attendance', label: 'Attendance', translationKey: 'nav.attendance', icon: CalendarDays, minimumPlan: 'starter' },
  { to: '/salary-slips', label: 'Salary Slips', translationKey: 'nav.salarySlips', icon: FileText, minimumPlan: 'starter' },
  { to: '/settings', label: 'Settings', translationKey: 'nav.settings', icon: Settings, minimumPlan: 'starter' },
  { to: '/settings/company', label: 'Company Settings', translationKey: 'nav.companySettings', icon: Building2, minimumPlan: 'starter' },
];

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
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
  const isAttendancePage = location.pathname === '/attendance';
  const isNavigationLocked = isAddEmployeePage || isEmployeeDetailPage || isGenerateSlipsPage || isAttendancePage;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const handleViewProfile = () => {
    if (isNavigationLocked) return;
    setIsProfileMenuOpen(false);
    navigate('/settings');
    onMobileClose();
  };

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    onMobileClose();
    logout();
    navigate('/login');
  };

  const visibleItems = navItems.filter((item) => hasMinimumPlan(user, item.minimumPlan));
  if (plan === 'enterprise' && user?.is_platform_admin) {
    visibleItems.push(
      { to: '/admin', label: 'Admin Overview', translationKey: 'nav.adminOverview', icon: ShieldCheck, minimumPlan: 'enterprise' },
      { to: '/admin/users', label: 'User Management', translationKey: 'nav.userManagement', icon: Users, minimumPlan: 'enterprise' },
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
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r lg:relative lg:z-30 lg:min-h-screen lg:translate-x-0 transition-[width,transform] duration-300 ease-in-out select-none",
        isDark ? "bg-[#0d0d10] border-white/[0.08] text-white" : "bg-white border-neutral-200/90 text-neutral-800 shadow-sm",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-[280px] lg:w-[72px]" : "w-[280px] lg:w-[260px]"
      )}>
      {/* Logo / Header */}
      <div className="pt-7 pb-8 px-4">
        {/* Mobile Header */}
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shadow-md shrink-0",
              isDark ? "bg-white text-black keep-white shadow-white/5" : "bg-black text-white shadow-black/10"
            )}>
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className={cn("text-[15px] font-bold tracking-tight whitespace-nowrap truncate", isDark ? "text-white" : "text-neutral-900")}>
                Pay Slip Pro
              </h1>
              <p className={cn("text-[10px] tracking-wide whitespace-nowrap truncate", isDark ? "text-neutral-400" : "text-neutral-500")}>
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

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                }
              }}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shadow-md shrink-0 transition-transform duration-200 cursor-pointer",
                isCollapsed && "hover:scale-105 active:scale-95",
                isDark ? "bg-white text-black keep-white shadow-white/5" : "bg-black text-white shadow-black/10"
              )}
              title={isCollapsed ? "Expand sidebar" : "Pay Slip Pro"}
              aria-label={isCollapsed ? "Expand sidebar" : "Pay Slip Pro"}
            >
              <FileText className="h-4 w-4 shrink-0" />
            </button>
            <div className={cn(
              "flex flex-col min-w-0 whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
              isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-[125px] opacity-100"
            )}>
              <h1 className={cn("text-[15px] font-bold tracking-tight whitespace-nowrap truncate", isDark ? "text-white" : "text-neutral-900")}>
                Pay Slip Pro
              </h1>
              <p className={cn("text-[10px] tracking-wide whitespace-nowrap truncate", isDark ? "text-neutral-400" : "text-neutral-500")}>
                Salary Management
              </p>
            </div>
          </div>
          <div className={cn(
            "transition-all duration-200 overflow-hidden shrink-0",
            isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-auto opacity-100"
          )}>
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200 shrink-0 border border-transparent cursor-pointer",
                isDark ? "text-neutral-400 hover:text-white hover:bg-white/[0.08] hover:border-white/10" : "text-neutral-400 hover:text-black hover:bg-neutral-100 hover:border-neutral-200"
              )}
              title={isCollapsed ? t('nav.expand', 'Expand sidebar') : t('nav.collapse', 'Collapse sidebar')}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className={cn("h-px mb-4 mx-4 transition-all duration-300", isDark ? "bg-white/[0.08]" : "bg-neutral-200/80")} />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-hidden">
        <p className={cn(
          'text-[10px] font-bold uppercase tracking-widest px-3 mb-2 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out',
          isDark ? 'text-neutral-500' : 'text-neutral-400',
          isCollapsed ? 'lg:h-0 lg:opacity-0 lg:mb-0' : 'lg:h-auto lg:opacity-100'
        )}>
          Menu
        </p>

        {visibleItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (!['/dashboard', '/admin', '/settings'].includes(item.to) && location.pathname.startsWith(item.to));

          const isCurrentSection =
            ((isAddEmployeePage || isEmployeeDetailPage) && item.to === '/employees') ||
            (isGenerateSlipsPage && item.to === '/salary-slips') ||
            (isAttendancePage && item.to === '/attendance');

          const isThisItemBlocked = isNavigationLocked && !isCurrentSection;

          const label = t(item.translationKey, item.label);
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
                    ? label
                    : undefined
              }
            >
              <div
                className={cn(
                  'flex items-center h-10 px-3 rounded-lg text-[13px] font-medium transition-all duration-200 relative overflow-hidden',
                  !isCollapsed && 'hover:translate-x-0.5',
                  isActive
                    ? isDark
                      ? 'keep-white bg-white !text-black shadow-md shadow-white/5 font-semibold'
                      : 'bg-neutral-900 text-white shadow-sm font-semibold'
                    : isDark
                      ? 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-black'
                )}
                style={isActive && isDark ? { backgroundColor: '#ffffff', color: '#000000' } : undefined}
              >
                <item.icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive 
                      ? isDark ? '!text-black' : 'text-white'
                      : isDark ? 'text-neutral-400' : 'text-neutral-500'
                  )}
                  style={isActive && isDark ? { color: '#000000' } : undefined}
                />
                <span
                  className={cn(
                    'whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ml-3 min-w-0',
                    isActive
                      ? isDark ? '!text-black font-semibold' : 'text-white font-semibold'
                      : isDark ? 'text-neutral-400' : 'text-neutral-600',
                    isCollapsed ? 'lg:w-0 lg:opacity-0 lg:ml-0' : 'lg:w-auto lg:opacity-100'
                  )}
                  style={isActive && isDark ? { color: '#000000' } : undefined}
                >
                  {label}
                </span>
                {item.to === '/settings/company' && !hasMinimumPlan(user, 'professional') && (
                  <span
                    className={cn(
                      'ml-auto items-center gap-1 text-[10px] font-extrabold tracking-wider px-1.5 py-0.5 rounded transition-all shrink-0',
                      isActive
                        ? isDark ? 'bg-black/15 text-black' : 'bg-white/25 text-white'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
                      isCollapsed ? 'hidden' : 'inline-flex'
                    )}
                  >
                    <Lock className="w-2.5 h-2.5" />
                    PRO
                  </span>
                )}
                {item.to === '/settings/company' && !hasMinimumPlan(user, 'professional') && isCollapsed && (
                  <span className="absolute top-2 right-2 p-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                    <Lock className="w-2 h-2" />
                  </span>
                )}
                {isActive && (
                  <div
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full transition-opacity duration-200',
                      isDark ? 'bg-black' : 'bg-white',
                      isCollapsed && 'lg:opacity-0'
                    )}
                    style={isDark ? { backgroundColor: '#000000' } : undefined}
                  />
                )}
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer - Profile Badge & Popover Menu */}
      <div
        ref={profileRef}
        className={cn(
          "relative pb-4 pt-3 border-t mt-auto px-3 transition-all duration-300",
          isDark ? "border-white/[0.08]" : "border-neutral-200/80"
        )}
      >
        {/* Profile Popover Menu */}
        {isProfileMenuOpen && (
          <div
            className={cn(
              "absolute z-50 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none",
              isDark
                ? "bg-[#141418]/95 border-white/[0.12] text-white shadow-2xl shadow-black/80"
                : "bg-white/95 border-neutral-200 text-neutral-800 shadow-xl shadow-neutral-900/15",
              isCollapsed
                ? "left-3 right-3 bottom-full mb-2 lg:left-full lg:right-auto lg:bottom-1 lg:ml-3 lg:mb-0 lg:w-60"
                : "left-3 right-3 bottom-full mb-2"
            )}
          >
            {/* User Info Header inside Popover */}
            <div className={cn(
              "px-3 py-2 border-b mb-1",
              isDark ? "border-white/[0.08]" : "border-neutral-100"
            )}>
              <div className="flex items-center justify-between gap-1.5">
                <p className={cn("text-[13px] font-bold truncate", isDark ? "text-white" : "text-neutral-900")}>
                  {user?.full_name || user?.email}
                </p>
                <span className={cn(
                  "shrink-0 text-[8px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border",
                  isDark ? "text-neutral-300 border-white/10 bg-white/[0.05]" : "text-neutral-700 border-neutral-200 bg-neutral-100"
                )}>
                  {plan}
                </span>
              </div>
              <p className={cn("text-[11px] truncate mt-0.5", isDark ? "text-neutral-400" : "text-neutral-500")}>
                {user?.email}
              </p>
            </div>

            {/* Field 1: View Profile */}
            <button
              type="button"
              onClick={handleViewProfile}
              disabled={isNavigationLocked}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left cursor-pointer",
                isNavigationLocked
                  ? "opacity-40 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-white/[0.08] text-neutral-200 hover:text-white"
                    : "hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900"
              )}
            >
              <User className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>{t('nav.viewProfile', 'View Profile')}</span>
            </button>

            {/* Field 2: Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left cursor-pointer",
                isDark
                  ? "text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
                  : "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>{t('nav.logout', 'Log Out')}</span>
            </button>
          </div>
        )}

        {/* Profile Badge Button */}
        <button
          type="button"
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
          className={cn(
            "w-full flex items-center h-11 px-2 rounded-xl transition-all duration-200 group text-left cursor-pointer",
            isCollapsed && "lg:justify-center lg:px-0",
            isProfileMenuOpen
              ? isDark
                ? "bg-white/[0.1] text-white"
                : "bg-neutral-100 text-black"
              : isDark
                ? "hover:bg-white/[0.08]"
                : "hover:bg-neutral-100"
          )}
          title={isCollapsed && !isProfileMenuOpen ? `${user?.full_name || user?.email} (${plan})` : undefined}
          aria-haspopup="true"
          aria-expanded={isProfileMenuOpen}
        >
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold shadow-md transition-transform group-hover:scale-105",
            isDark ? "keep-white bg-white text-black shadow-white/5" : "bg-neutral-900 text-white shadow-sm"
          )}>
            {initials}
          </div>
          <div className={cn(
            "min-w-0 flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ml-3",
            isCollapsed ? "lg:w-0 lg:opacity-0 lg:ml-0 lg:pointer-events-none" : "lg:w-auto lg:opacity-100"
          )}>
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
          <div className={cn(
            "shrink-0 transition-transform duration-200",
            isCollapsed ? "lg:hidden" : "ml-1.5",
            isProfileMenuOpen ? "rotate-180 text-neutral-200" : "text-neutral-400"
          )}>
            <ChevronUp className="h-4 w-4" />
          </div>
        </button>
      </div>
    </aside>
    </>
  );
}
