import { ChevronDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { authApi } from "@/features/auth/api";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/cn";
import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { toast } from "@/stores/toastStore";
import type { ThemePreference } from "@/types/user";

const themeOptions: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

const statusOptions = [
  { value: "online", label: "Online", dotClass: "bg-signal" },
  { value: "away", label: "Away", dotClass: "bg-ember" },
  { value: "offline", label: "Appear offline", dotClass: "bg-stone-400" },
] as const;

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const ownStatus = usePresenceStore((s) => (user ? s.statuses[user.id]?.status : undefined));
  const status = ownStatus ?? "online";

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      /* clear local state regardless — the cookie is gone either way */
    }
    clearAuth();
    navigate("/login", { replace: true });
    toast.info("Logged out.");
  }

  const activeStatus = statusOptions.find((s) => s.value === status) ?? statusOptions[0];

  return (
    <header className="flex h-14 items-center justify-between border-b border-(--border) bg-(--surface) px-3 sm:px-4">
      <div className="font-display font-semibold md:hidden">SheyiHub</div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-1">
        <div className="hidden items-center rounded-md border border-(--border) p-0.5 sm:flex">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              aria-label={`${label} theme`}
              aria-pressed={theme === value}
              className={cn(
                "rounded p-1.5",
                theme === value
                  ? "bg-pine text-white dark:bg-white/15"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setStatusOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100 dark:hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            aria-label={`Presence: ${activeStatus.label}`}
          >
            <span className={cn("size-2 rounded-full", activeStatus.dotClass)} aria-hidden />
            <span className="hidden sm:inline">{activeStatus.label}</span>
            <ChevronDown className="hidden size-3.5 sm:block" />
          </button>
          {statusOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-(--border) bg-(--surface-raised) p-1 shadow-[var(--shadow-elevation-2)]"
            >
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  role="menuitem"
                  onClick={() => {
                    wsClient.send({ type: "set-status", status: opt.value });
                    setStatusOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-white/10"
                >
                  <span className={cn("size-2 rounded-full", opt.dotClass)} aria-hidden />
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <NotificationBell />

        <div className="relative">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-stone-100 dark:hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            aria-label="Open account menu"
          >
            <Avatar name={user?.display_name ?? "User"} src={user?.avatar_url} size="sm" />
          </button>
          {profileOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-(--border) bg-(--surface-raised) p-1.5 shadow-[var(--shadow-elevation-2)]"
            >
              <div className="flex items-center gap-3 border-b border-(--border) px-2 py-2.5">
                <Avatar name={user?.display_name ?? "User"} src={user?.avatar_url} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-(--text-primary)">{user?.display_name}</p>
                  <p className="truncate text-xs text-(--text-secondary)">{user?.email}</p>
                </div>
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("/settings");
                }}
                className="mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-white/10"
              >
                <Settings className="size-4" /> Settings
              </button>
              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-rust hover:bg-rust/10"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
