import { Outlet } from "react-router-dom";

import { MobileNav } from "@/components/MobileNav";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useNotificationEvents } from "@/features/notifications/useNotificationEvents";

export function DashboardLayout() {
  useNotificationEvents();

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <div className="mx-auto max-w-[960px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
