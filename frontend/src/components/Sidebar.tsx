import { Calendar, LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/meetings", label: "Meetings", icon: Calendar },
  { to: "/chats", label: "Chats", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside
      className="hidden w-60 shrink-0 flex-col gap-1 p-3 md:flex"
      style={{ backgroundColor: "var(--sidebar-bg)", color: "var(--sidebar-text)" }}
      aria-label="Primary"
    >
      <div className="px-2 py-3 font-display text-lg font-semibold">SheyiHub</div>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember",
                isActive ? "bg-white/15" : "hover:bg-white/10 opacity-90 hover:opacity-100"
              )
            }
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
