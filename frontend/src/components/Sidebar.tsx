import { Bell, Building2, CalendarDays, CheckSquare2, LayoutDashboard, MessageCircleMore, Settings2, Sparkles } from "lucide-react";
import { useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Avatar } from "@/components/Avatar";
import { workspacesApi } from "@/features/workspaces/api";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chats", label: "Chats", icon: MessageCircleMore },
  { to: "/meetings", label: "Meetings", icon: CalendarDays },
  { to: "/tasks", label: "Tasks", icon: CheckSquare2 },
  { to: "/workspaces", label: "Workspaces", icon: Building2 },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list, retry: false });
  const workspaces = useMemo(() => Array.isArray(workspacesQuery.data) ? workspacesQuery.data : (workspacesQuery.data?.results ?? []), [workspacesQuery.data]);
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    if (!activeWorkspaceId && workspaces[0]) setActiveWorkspaceId(workspaces[0].id);
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  return (
    <aside className="relative hidden w-[248px] shrink-0 flex-col overflow-hidden border-r border-white/7 px-3.5 py-4 md:flex xl:w-[260px]" style={{ backgroundColor: "var(--sidebar-bg)", color: "var(--sidebar-text)" }} aria-label="Primary">
      <div className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-[#7d54ff]/16 blur-3xl" />
      <div className="pointer-events-none absolute bottom-28 right-[-6rem] size-52 rounded-full bg-[#a044ee]/8 blur-3xl" />
      <div className="relative flex items-center gap-3 px-2 pb-6 pt-1"><span className="brand-mark">S</span><div className="min-w-0"><p className="font-display text-[16px] font-semibold tracking-[-0.025em] text-white">SheyiHub</p><p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/38">Workspace</p></div></div>

      <div className="relative mb-5 rounded-[15px] border border-white/8 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-[11px] bg-gradient-to-br from-[#704cff]/28 to-[#9f43ec]/15 text-[#b49cff]"><Sparkles className="size-[17px]" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white/92">{active?.name ?? "My workspace"}</p><p className="mt-0.5 truncate text-[10px] text-white/38">{active ? `${active.member_count} members · ${active.role}` : "Create a team space"}</p></div></div>
        {workspaces.length > 1 ? <select aria-label="Switch workspace" value={active?.id ?? ""} onChange={(e) => setActiveWorkspaceId(e.target.value)} className="mt-2 h-8 w-full rounded-[9px] border border-white/8 bg-black/20 px-2 text-[10px] text-white/70 outline-none">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select> : null}
      </div>

      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">Workspace</p>
      <nav className="relative flex flex-col gap-1">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => cn("group relative flex h-11 items-center gap-3 rounded-[11px] px-3 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember", isActive ? "bg-gradient-to-r from-[#7657ff]/25 to-[#9a48ee]/10 text-white shadow-[inset_0_0_0_1px_rgba(145,102,255,.16)]" : "text-white/58 hover:bg-white/[0.055] hover:text-white/92")}>{({ isActive }) => <>{isActive ? <span className="absolute left-0 h-5 w-[2px] rounded-full bg-[#9d7aff] shadow-[0_0_14px_#8f6bff]" /> : null}<Icon className={cn("size-[17px] shrink-0", isActive ? "text-[#aa91ff]" : "text-white/44 group-hover:text-white/75")} aria-hidden /><span className="truncate">{label}</span></>}</NavLink>)}</nav>

      <div className="mt-auto space-y-2 pt-5"><NavLink to="/settings" className={({ isActive }) => cn("flex h-11 items-center gap-3 rounded-[11px] px-3 text-[13px] font-medium transition-colors", isActive ? "bg-white/[0.08] text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white")}><Settings2 className="size-[17px]" />Settings</NavLink><NavLink to="/settings" className="flex items-center gap-3 rounded-[15px] border border-white/8 bg-white/[0.035] p-2.5 transition-colors hover:bg-white/[0.06]"><div className="relative shrink-0"><Avatar name={user?.display_name ?? "User"} src={user?.avatar_url} size="md" /><span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#090c1b] bg-signal" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white/92">{user?.display_name ?? "Your profile"}</p><p className="mt-0.5 truncate text-[9px] text-white/38">Available</p></div></NavLink></div>
    </aside>
  );
}
