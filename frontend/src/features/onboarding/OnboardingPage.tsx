import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, CheckCircle2, MessageCircleMore, Sparkles, UserRound, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { workspacesApi } from "@/features/workspaces/api";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { toast } from "@/stores/toastStore";

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const [workspaceName, setWorkspaceName] = useState(`${user?.display_name?.split(" ")[0] || "My"}'s workspace`);
  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list });
  const workspaces = useMemo(() => Array.isArray(workspacesQuery.data) ? workspacesQuery.data : (workspacesQuery.data?.results ?? []), [workspacesQuery.data]);

  const createWorkspace = useMutation({
    mutationFn: () => workspacesApi.create({ name: workspaceName.trim() }),
    onSuccess: (workspace) => {
      setActiveWorkspaceId(workspace.id);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace ready.");
      navigate("/tasks");
    },
    onError: () => toast.error("Couldn't create your workspace."),
  });

  const steps = [
    { label: "Email verified", done: !!user?.email_verified, icon: CheckCircle2 },
    { label: "Profile ready", done: !!user?.display_name, icon: UserRound },
    { label: "Workspace created", done: workspaces.length > 0, icon: Building2 },
  ];

  return (
    <div className="mx-auto max-w-[1080px] pb-4">
      <section className="relative overflow-hidden rounded-[22px] border border-(--border) bg-(--surface-raised) p-5 shadow-[var(--shadow-elevation-2)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-ember/15 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ember"><Sparkles className="size-4" /> First run</div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Welcome to your SheyiHub.</h1>
            <p className="mt-3 max-w-xl text-xs leading-6 text-(--text-secondary) sm:text-sm">Set up one workspace and you are ready to chat, meet and organise work without leaving the product.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-3">{steps.map(({ label, done, icon: Icon }) => <div key={label} className="rounded-[13px] border border-(--border) bg-(--surface-soft) p-3"><Icon className={`size-4 ${done ? "text-signal" : "text-(--text-secondary)"}`} /><p className="mt-2 text-[10px] font-semibold">{label}</p><p className="mt-1 text-[9px] text-(--text-secondary)">{done ? "Complete" : "Not yet"}</p></div>)}</div>
          </div>
          <Card className="p-4 sm:p-5">
            {workspaces.length === 0 ? <><p className="text-xs font-semibold">Create your first workspace</p><p className="mt-1 text-[10px] leading-5 text-(--text-secondary)">You can rename it anytime.</p><div className="mt-4"><Input label="Workspace name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} /></div><Button className="mt-4 w-full" onClick={() => { if (!workspaceName.trim()) return toast.error("Enter a workspace name."); createWorkspace.mutate(); }} isLoading={createWorkspace.isPending}>Create workspace <ArrowRight className="size-4" /></Button></> : <><p className="text-xs font-semibold">You're set up.</p><p className="mt-1 text-[10px] leading-5 text-(--text-secondary)">Continue with your active workspace or jump into collaboration.</p><Button className="mt-4 w-full" onClick={() => { setActiveWorkspaceId(workspaces[0].id); navigate("/dashboard"); }}>Open dashboard <ArrowRight className="size-4" /></Button></>}
          </Card>
        </div>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Card className="p-4"><MessageCircleMore className="size-5 text-ember" /><h2 className="mt-3 text-xs font-semibold">Start a conversation</h2><p className="mt-1 text-[9.5px] leading-4 text-(--text-secondary)">Message a collaborator in real time.</p><Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/chats")}>Open chats</Button></Card><Card className="p-4"><Video className="size-5 text-ember" /><h2 className="mt-3 text-xs font-semibold">Schedule a meeting</h2><p className="mt-1 text-[9.5px] leading-4 text-(--text-secondary)">Bring your team into a live room.</p><Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/meetings/schedule")}>Plan meeting</Button></Card><Card className="p-4"><CheckCircle2 className="size-5 text-ember" /><h2 className="mt-3 text-xs font-semibold">Organise work</h2><p className="mt-1 text-[9.5px] leading-4 text-(--text-secondary)">Create and move tasks across a Kanban board.</p><Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/tasks")}>Open tasks</Button></Card></div>
    </div>
  );
}
