import { Bell, CalendarDays, CheckSquare2, LayoutDashboard, MessageCircleMore, Plus, X } from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/cn";

const leftItems = [{ to: "/dashboard", label: "Home", icon: LayoutDashboard }, { to: "/chats", label: "Chats", icon: MessageCircleMore }];
const rightItems = [{ to: "/meetings", label: "Meetings", icon: CalendarDays }, { to: "/tasks", label: "Tasks", icon: CheckSquare2 }];

function MobileNavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) { return <NavLink to={to} className={({ isActive }) => cn("flex min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] min-h-12 py-1.5 text-[9px] font-semibold transition-colors", isActive ? "bg-ember/12 text-ember" : "text-(--text-secondary) active:bg-ember/8")}><Icon className="size-[18px]" aria-hidden /><span className="max-w-full truncate">{label}</span></NavLink>; }

export function MobileNav() {
  const [createOpen, setCreateOpen] = useState(false); const navigate = useNavigate();
  function go(to: string) { setCreateOpen(false); navigate(to); }
  const actions = [
    { to: "/chats", label: "New conversation", note: "Message your team", icon: MessageCircleMore },
    { to: "/meetings/schedule", label: "Schedule meeting", note: "Plan a live room", icon: CalendarDays },
    { to: "/tasks", label: "Create task", note: "Organise the next step", icon: CheckSquare2 },
    { to: "/notifications", label: "Activity", note: "See recent updates", icon: Bell },
  ];
  return <><nav className="fixed inset-x-2.5 bottom-[max(.6rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 items-end rounded-[20px] border border-(--border) bg-(--surface-raised) p-1.5 shadow-[var(--shadow-elevation-4)] backdrop-blur-xl md:hidden" aria-label="Primary">{leftItems.map((item) => <MobileNavItem key={item.to} {...item} />)}<button type="button" onClick={() => setCreateOpen(true)} className="group -mt-5 flex min-w-0 flex-col items-center gap-1 text-[9px] font-semibold text-ember" aria-label="Create"><span className="grid size-[50px] place-items-center rounded-[16px] border-4 border-(--surface) bg-gradient-to-br from-[#7657ff] to-[#a13df0] text-white shadow-[0_12px_34px_rgba(122,77,255,.38)] transition active:scale-95"><Plus className="size-5" /></span><span>Create</span></button>{rightItems.map((item) => <MobileNavItem key={item.to} {...item} />)}</nav>{createOpen ? <div className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[5px] md:hidden" onMouseDown={() => setCreateOpen(false)}><div className="w-full rounded-t-[24px] border border-b-0 border-(--border) bg-(--surface-raised) px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-elevation-4)]" onMouseDown={(event) => event.stopPropagation()}><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--border-strong)" /><div className="mb-3 flex items-center justify-between"><div><p className="font-display text-base font-semibold">Create in SheyiHub</p><p className="mt-0.5 text-[10px] text-(--text-secondary)">Jump straight into your next action.</p></div><button type="button" onClick={() => setCreateOpen(false)} className="grid size-9 place-items-center rounded-[10px] text-(--text-secondary) active:bg-ember/8" aria-label="Close create menu"><X className="size-4" /></button></div><div className="grid grid-cols-2 gap-2">{actions.map(({ to, label, note, icon: Icon }) => <button key={to} type="button" onClick={() => go(to)} className="premium-panel flex min-h-24 flex-col items-start justify-between rounded-[16px] p-4 text-left active:border-ember/35"><span className="grid size-9 place-items-center rounded-[10px] bg-ember/10 text-ember"><Icon className="size-4" /></span><span><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-[9px] text-(--text-secondary)">{note}</span></span></button>)}</div></div></div> : null}</>;
}
