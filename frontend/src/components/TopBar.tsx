import {
  CalendarPlus,
  Building2,
  CheckSquare2,
  ChevronDown,
  Command,
  LayoutDashboard,
  LogOut,
  MessageCircleMore,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/Avatar";
import { authApi } from "@/features/auth/api";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { searchApi } from "@/features/search/api";
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
  { value: "away", label: "Away", dotClass: "bg-amber-400" },
  { value: "offline", label: "Appear offline", dotClass: "bg-stone-400" },
] as const;
const quickRoutes = [
  { label: "Dashboard", description: "Workspace overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Chats", description: "Messages and conversations", to: "/chats", icon: MessageCircleMore },
  { label: "Meetings", description: "Upcoming and past meetings", to: "/meetings", icon: CalendarPlus },
  { label: "Tasks", description: "Organise work on a workspace board", to: "/tasks", icon: CheckSquare2 },
  { label: "Workspaces", description: "Switch teams and manage members", to: "/workspaces", icon: Building2 },
  { label: "Settings", description: "Profile and preferences", to: "/settings", icon: Settings },
];
const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/chats": "Chats",
  "/meetings": "Meetings",
  "/notifications": "Notifications",
  "/tasks": "Tasks",
  "/workspaces": "Workspaces",
  "/onboarding": "Welcome",
  "/settings": "Settings",
};

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ownStatus = usePresenceStore((s) => (user ? s.statuses[user.id]?.status : undefined));
  const status = ownStatus ?? "online";
  const activeStatus = statusOptions.find((s) => s.value === status) ?? statusOptions[0];
  const pageTitle = useMemo(
    () =>
      routeTitles[location.pathname] ??
      (location.pathname.startsWith("/chats/")
        ? "Chats"
        : location.pathname.startsWith("/meetings/")
          ? "Meetings"
          : "SheyiHub"),
    [location.pathname]
  );
  const filteredRoutes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? quickRoutes.filter(
          (r) =>
            r.label.toLowerCase().includes(normalized) || r.description.toLowerCase().includes(normalized)
        )
      : quickRoutes;
  }, [query]);
  const globalSearchQuery = useQuery({
    queryKey: ["global-search", query.trim()],
    queryFn: () => searchApi.search(query.trim()),
    enabled: commandOpen && query.trim().length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setProfileOpen(false);
        setStatusOpen(false);
        setCreateOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      /* clear local auth anyway */
    }
    clearAuth();
    navigate("/login", { replace: true });
    toast.info("Logged out.");
  }
  function go(to: string) {
    setCommandOpen(false);
    setCreateOpen(false);
    setQuery("");
    navigate(to);
  }

  return (
    <>
      <header className="relative z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-(--border) bg-(--surface-raised) px-2.5 backdrop-blur-xl sm:h-[64px] sm:px-5 lg:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5 md:hidden">
            <span className="brand-mark !size-8 !rounded-[9px] !text-[15px]">S</span>
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-[13px] font-semibold">SheyiHub</span>
              <span className="block max-w-[9rem] truncate text-[9px] font-medium uppercase tracking-[0.12em] text-(--text-secondary)">{pageTitle}</span>
            </div>
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-(--text-secondary)">
              Workspace
            </p>
            <p className="truncate font-display text-sm font-semibold tracking-[-0.02em] text-(--text-primary)">
              {pageTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="absolute left-1/2 hidden h-9 w-[min(34vw,430px)] -translate-x-1/2 items-center gap-2 rounded-[10px] border border-(--border) bg-(--surface-soft) px-3 text-left text-xs text-(--text-secondary) transition-colors hover:border-ember/35 hover:text-(--text-primary) lg:flex"
          aria-label="Search SheyiHub"
        >
          <Search className="size-4" />
          <span className="flex-1">Search SheyiHub...</span>
          <span className="flex items-center gap-1 rounded-md border border-(--border) bg-(--surface-raised) px-1.5 py-0.5 font-mono text-[10px]">
            <Command className="size-2.5" />K
          </span>
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="grid size-9 place-items-center rounded-[10px] text-(--text-secondary) hover:bg-ember/8 hover:text-(--text-primary) lg:hidden"
            aria-label="Search SheyiHub"
          >
            <Search className="size-[18px]" />
          </button>
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setCreateOpen((open) => !open)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-[#7657ff] to-[#963ff0] px-3.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(118,87,255,.2)] transition hover:brightness-110"
              aria-haspopup="menu"
              aria-expanded={createOpen}
            >
              <Plus className="size-4" />
              Create
            </button>
            {createOpen ? (
              <div
                role="menu"
                className="premium-panel absolute right-0 z-40 mt-2 w-52 rounded-[13px] p-1.5 shadow-[var(--shadow-elevation-4)]"
              >
                <button
                  role="menuitem"
                  onClick={() => go("/chats")}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-xs hover:bg-ember/8"
                >
                  <MessageCircleMore className="size-4 text-ember" />
                  New conversation
                </button>
                <button
                  role="menuitem"
                  onClick={() => go("/meetings/schedule")}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-xs hover:bg-ember/8"
                >
                  <CalendarPlus className="size-4 text-ember" />
                  Schedule meeting
                </button>
                <button
                  role="menuitem"
                  onClick={() => go("/tasks")}
                  className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-xs hover:bg-ember/8"
                >
                  <CheckSquare2 className="size-4 text-ember" />
                  Create task
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative hidden sm:block">
            <button
              onClick={() => setStatusOpen((open) => !open)}
              className="flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[10px] font-medium text-(--text-secondary) hover:bg-ember/8 hover:text-(--text-primary)"
              aria-haspopup="menu"
              aria-expanded={statusOpen}
              aria-label={`Presence: ${activeStatus.label}`}
            >
              <span className={cn("size-2 rounded-full", activeStatus.dotClass)} />
              <span>{activeStatus.label}</span>
              <ChevronDown className="size-3" />
            </button>
            {statusOpen ? (
              <div
                role="menu"
                className="premium-panel absolute right-0 z-40 mt-2 w-40 rounded-[12px] p-1.5 shadow-[var(--shadow-elevation-4)]"
              >
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    role="menuitem"
                    onClick={() => {
                      wsClient.send({ type: "set-status", status: option.value });
                      setStatusOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[10px] hover:bg-ember/8"
                  >
                    <span className={cn("size-2 rounded-full", option.dotClass)} />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <NotificationBell />
          <div className="relative">
            <button
              onClick={() => setProfileOpen((open) => !open)}
              className="flex items-center gap-2 rounded-[11px] p-1.5 hover:bg-ember/8"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Open account menu"
            >
              <Avatar name={user?.display_name ?? "User"} src={user?.avatar_url} size="sm" />
              <ChevronDown className="hidden size-3.5 text-(--text-secondary) sm:block" />
            </button>
            {profileOpen ? (
              <div
                role="menu"
                className="premium-panel absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-[15px] p-2 shadow-[var(--shadow-elevation-4)]"
              >
                <div className="flex items-center gap-3 border-b border-(--border) px-2 py-2.5">
                  <div className="relative">
                    <Avatar name={user?.display_name ?? "User"} src={user?.avatar_url} size="md" />
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-(--surface-raised)",
                        activeStatus.dotClass
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user?.display_name}</p>
                    <p className="truncate text-[11px] text-(--text-secondary)">{user?.email}</p>
                  </div>
                </div>
                <div className="my-1.5 border-t border-(--border) pt-1.5">
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--text-secondary)">
                    Appearance
                  </p>
                  <div className="grid grid-cols-3 gap-1 px-1">
                    {themeOptions.map(({ value, icon: Icon, label }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        aria-label={`${label} theme`}
                        aria-pressed={theme === value}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-[9px] px-2 py-2 text-[10px]",
                          theme === value
                            ? "bg-ember/12 text-ember"
                            : "text-(--text-secondary) hover:bg-ember/8"
                        )}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings");
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-xs hover:bg-ember/8"
                >
                  <Settings className="size-4" />
                  Settings
                </button>
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-xs text-rust hover:bg-rust/10"
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {commandOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-3 pt-[8vh] backdrop-blur-[6px] sm:px-4 sm:pt-[12vh]"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div
            className="premium-panel w-full max-w-xl overflow-hidden rounded-[18px] shadow-[var(--shadow-elevation-4)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-(--border) px-4">
              <Search className="size-5 text-(--text-secondary)" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people, messages, meetings, workspaces and tasks..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-(--text-secondary)"
              />
              <button
                onClick={() => setCommandOpen(false)}
                aria-label="Close search"
                className="grid size-8 place-items-center rounded-[8px] text-(--text-secondary) hover:bg-ember/8"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-2">
              <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--text-secondary)">
                Quick navigation
              </p>
              {filteredRoutes.length ? (
                filteredRoutes.map(({ label, description, to, icon: Icon }) => (
                  <button
                    key={to}
                    onClick={() => go(to)}
                    className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left hover:bg-ember/8"
                  >
                    <span className="grid size-9 place-items-center rounded-[10px] bg-ember/10 text-ember">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="mt-0.5 block text-[11px] text-(--text-secondary)">{description}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-sm text-(--text-secondary)">No matching page.</p>
              )}
              {query.trim().length >= 2 ? (
                <div className="mt-2 border-t border-(--border) pt-2">
                  <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--text-secondary)">Search SheyiHub</p>
                  {globalSearchQuery.isLoading ? (
                    <p className="px-3 py-4 text-xs text-(--text-secondary)">Searching…</p>
                  ) : globalSearchQuery.data?.results.length ? (
                    globalSearchQuery.data.results.map((result) => (
                      <button key={`${result.kind}-${result.id}`} onClick={() => go(result.target_url)} className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left hover:bg-ember/8">
                        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-ember/10 text-[9px] font-bold uppercase text-ember">{result.kind.slice(0, 2)}</span>
                        <span className="min-w-0"><span className="block truncate text-xs font-medium">{result.label}</span><span className="mt-0.5 block truncate text-[10px] text-(--text-secondary)">{result.subtitle}</span></span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-xs text-(--text-secondary)">No content matches this search yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
