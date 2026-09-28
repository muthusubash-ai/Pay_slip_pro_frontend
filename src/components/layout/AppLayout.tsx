import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen h-dvh bg-neutral-50 overflow-hidden">
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-5 lg:p-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
