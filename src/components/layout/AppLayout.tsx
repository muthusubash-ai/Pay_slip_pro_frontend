import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { isUserPlanExpired } from '../../lib/plans';
import { PlanExpiredModal } from '../plans/PlanExpiredModal';

export function AppLayout() {
  const { user } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isPlanExpired = isUserPlanExpired(user);

  return (
    <div className="flex min-h-screen h-dvh bg-neutral-50 overflow-hidden relative">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <div className={`flex-1 flex flex-col min-w-0 transition-all ${isPlanExpired ? 'pointer-events-none select-none blur-[1px]' : ''}`}>
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-5 lg:p-7">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Plan Expired Blocking Modal with Page Freeze */}
      <PlanExpiredModal isOpen={isPlanExpired} />
    </div>
  );
}
