import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, Calendar, CheckCircle2, Circle, Clock3, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Input, TextArea } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { tasksApi } from "@/features/tasks/api";
import { workspacesApi } from "@/features/workspaces/api";
import { ApiError } from "@/lib/apiClient";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { toast } from "@/stores/toastStore";
import type { TaskPriority, TaskStatus, WorkspaceTask } from "@/types/task";

const columns: { value: TaskStatus; label: string; icon: typeof Circle }[] = [
  { value: "todo", label: "To do", icon: Circle },
  { value: "in_progress", label: "In progress", icon: Clock3 },
  { value: "review", label: "Review", icon: AlertTriangle },
  { value: "done", label: "Done", icon: CheckCircle2 },
];

const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function dueLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list });
  const workspaces = useMemo(() => Array.isArray(workspacesQuery.data) ? workspacesQuery.data : (workspacesQuery.data?.results ?? []), [workspacesQuery.data]);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    if (!activeWorkspaceId && workspaces[0]) setActiveWorkspaceId(workspaces[0].id);
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  const tasksQuery = useQuery({
    queryKey: ["tasks", activeWorkspace?.id],
    queryFn: () => tasksApi.list(activeWorkspace!.id),
    enabled: !!activeWorkspace,
  });
  const tasks = useMemo(() => Array.isArray(tasksQuery.data) ? tasksQuery.data : (tasksQuery.data?.results ?? []), [tasksQuery.data]);
  const visibleTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? tasks.filter((task) => `${task.title} ${task.description}`.toLowerCase().includes(needle)) : tasks;
  }, [search, tasks]);

  const createMutation = useMutation({
    mutationFn: () => tasksApi.create({ workspace: activeWorkspace!.id, title: title.trim(), description: description.trim(), priority, due_date: dueDate || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", activeWorkspace?.id] });
      setTitle(""); setDescription(""); setPriority("medium"); setDueDate(""); setCreateOpen(false);
      toast.success("Task created.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create the task.")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: TaskStatus; position?: number } }) => tasksApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", activeWorkspace?.id] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't move that task.")),
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks", activeWorkspace?.id] }); toast.success("Task deleted."); },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete that task.")),
  });

  function createTask(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return toast.error("Task title is required.");
    createMutation.mutate();
  }

  function moveTask(task: WorkspaceTask, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.value === task.status);
    const next = columns[index + direction];
    if (!next) return;
    const position = visibleTasks.filter((candidate) => candidate.status === next.value).length + 1;
    updateMutation.mutate({ id: task.id, data: { status: next.value, position } });
  }

  if (!workspacesQuery.isLoading && workspaces.length === 0) {
    return (
      <Card className="mx-auto max-w-2xl p-8">
        <EmptyState icon={CheckCircle2} title="Tasks need a workspace" description="Create a workspace first, then SheyiHub can organise work for that team." action={<Button onClick={() => navigate("/workspaces")}><Plus className="size-4" /> Create workspace</Button>} />
      </Card>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 pb-2">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)] sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-ember/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember"><CheckCircle2 className="size-3.5" /> Work board</div>
            <h1 className="font-display text-[24px] font-semibold tracking-[-0.045em] sm:text-[30px]">Tasks</h1>
            <p className="mt-1 text-[11px] text-(--text-secondary)">{activeWorkspace ? activeWorkspace.name : "Loading workspace…"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-[220px] flex-1 sm:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--text-secondary)" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="h-10 w-full rounded-[11px] border border-(--border) bg-(--surface-soft) pl-9 pr-3 text-xs outline-none focus:border-ember" /></label>
            <select value={activeWorkspace?.id ?? ""} onChange={(e) => setActiveWorkspaceId(e.target.value)} className="h-10 rounded-[11px] border border-(--border) bg-(--surface-soft) px-3 text-xs outline-none">
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New task</Button>
          </div>
        </div>
      </section>

      {tasksQuery.isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-6 animate-spin text-ember" /></div> : (
        <div className="soft-scrollbar grid min-h-[520px] grid-cols-1 gap-3 overflow-x-auto pb-2 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map((column, columnIndex) => {
            const Icon = column.icon;
            const columnTasks = visibleTasks.filter((task) => task.status === column.value).sort((a,b) => a.position - b.position);
            return (
              <section key={column.value} className="min-w-0 rounded-[16px] border border-(--border) bg-(--surface-soft)/55 p-2.5 sm:p-3">
                <div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><Icon className="size-4 text-ember" /><h2 className="text-xs font-semibold">{column.label}</h2></div><Badge>{columnTasks.length}</Badge></div>
                <div className="space-y-2.5">
                  {columnTasks.map((task) => (
                    <article key={task.id} className="premium-panel rounded-[14px] p-3.5">
                      <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={task.priority === "urgent" ? "rust" : task.priority === "high" ? "ember" : "neutral"}>{task.priority}</Badge>{task.due_date ? <span className="flex items-center gap-1 text-[9px] text-(--text-secondary)"><Calendar className="size-3" /> {dueLabel(task.due_date)}</span> : null}</div><h3 className="mt-2 text-xs font-semibold leading-5">{task.title}</h3>{task.description ? <p className="mt-1 line-clamp-3 text-[9.5px] leading-4.5 text-(--text-secondary)">{task.description}</p> : null}</div><button onClick={() => { if (window.confirm("Delete this task?")) deleteMutation.mutate(task.id); }} className="grid size-7 shrink-0 place-items-center rounded-[8px] text-(--text-secondary) hover:bg-rust/10 hover:text-rust" aria-label="Delete task"><Trash2 className="size-3.5" /></button></div>
                      <div className="mt-3 flex items-center justify-between border-t border-(--border) pt-2.5"><div className="flex items-center gap-2">{task.assignee ? <><Avatar name={task.assignee.display_name} src={task.assignee.avatar_url} size="sm" /><span className="hidden max-w-20 truncate text-[9px] text-(--text-secondary) 2xl:inline">{task.assignee.display_name}</span></> : <span className="text-[9px] text-(--text-secondary)">Unassigned</span>}</div><div className="flex gap-1"><button disabled={columnIndex === 0 || updateMutation.isPending} onClick={() => moveTask(task, -1)} className="grid size-7 place-items-center rounded-[8px] border border-(--border) text-(--text-secondary) disabled:opacity-30"><ArrowLeft className="size-3.5" /></button><button disabled={columnIndex === columns.length - 1 || updateMutation.isPending} onClick={() => moveTask(task, 1)} className="grid size-7 place-items-center rounded-[8px] border border-(--border) text-(--text-secondary) disabled:opacity-30"><ArrowRight className="size-3.5" /></button></div></div>
                    </article>
                  ))}
                  {columnTasks.length === 0 ? <div className="rounded-[12px] border border-dashed border-(--border) px-3 py-8 text-center text-[9px] text-(--text-secondary)">No tasks here</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create task">
        <form className="space-y-4" onSubmit={createTask}>
          <Input label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="Prepare release notes" />
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done?" />
          <div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-[10px] font-semibold text-(--text-secondary)">Priority</label><select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="h-11 w-full rounded-[11px] border border-(--border) bg-(--surface-soft) px-3 text-xs outline-none">{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" isLoading={createMutation.isPending}>Create task</Button></div>
        </form>
      </Modal>
    </div>
  );
}
