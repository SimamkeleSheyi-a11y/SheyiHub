import { Calendar, LayoutDashboard, MessageSquare, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/cn";

const navItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/meetings", label: "Meetings", icon: Calendar },
  { to: "/chats", label: "Chats", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Bottom tab bar for mobile (<640px) — Phase 3 §4 responsive spec. */
export function MobileNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-(--border) bg-(--surface-raised) md:hidden"
      aria-label="Primary"
    >
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
              isActive ? "text-ember-dark dark:text-ember" : "text-(--text-secondary)"
            )
          }
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
