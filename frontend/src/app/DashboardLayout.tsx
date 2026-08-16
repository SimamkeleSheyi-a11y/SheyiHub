import { Outlet } from "react-router-dom";

import { ConnectionBanner } from "@/components/ConnectionBanner";
import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useNotificationEvents } from "@/features/notifications/useNotificationEvents";

export function DashboardLayout() {
  useNotificationEvents();

  return (
    <div className="app-shell flex h-[100dvh] min-h-[100dvh] overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <ConnectionBanner />
        <main className="soft-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-[calc(7.25rem+env(safe-area-inset-bottom))] pt-2.5 sm:px-4 sm:pt-4 md:pb-6 lg:px-6 lg:pt-5 xl:px-8">
          <div className="mx-auto w-full max-w-[1520px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
