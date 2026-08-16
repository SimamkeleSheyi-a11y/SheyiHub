import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronRight, Crown, Loader2, Plus, Shield, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Input, TextArea } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { workspacesApi } from "@/features/workspaces/api";
import { ApiError } from "@/lib/apiClient";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { toast } from "@/stores/toastStore";
import type { WorkspaceRole } from "@/types/workspace";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function roleIcon(role: WorkspaceRole) {
  if (role === "owner") return Crown;
  if (role === "admin") return Shield;
  return Users;
}

export function WorkspacesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<WorkspaceRole>("member");

  const query = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list });
  const workspaces = useMemo(
    () => (Array.isArray(query.data) ? query.data : (query.data?.results ?? [])),
    [query.data]
  );
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  useEffect(() => {
    if (!activeWorkspaceId && workspaces[0]) setActiveWorkspaceId(workspaces[0].id);
    if (activeWorkspaceId && workspaces.length && !workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  const membersQuery = useQuery({
    queryKey: ["workspace-members", activeWorkspace?.id],
    queryFn: () => workspacesApi.members(activeWorkspace!.id),
    enabled: !!activeWorkspace,
  });

  const createMutation = useMutation({
    mutationFn: () => workspacesApi.create({ name: name.trim(), description: description.trim() }),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setActiveWorkspaceId(workspace.id);
      setName("");
      setDescription("");
      setCreateOpen(false);
      toast.success("Workspace created.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't create the workspace.")),
  });

  const addMemberMutation = useMutation({
    mutationFn: () => workspacesApi.addMember(activeWorkspace!.id, { email: memberEmail.trim(), role: memberRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", activeWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setMemberEmail("");
      setMemberRole("member");
      setMemberOpen(false);
      toast.success("Member added to workspace.");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't add that member.")),
  });

  function createWorkspace(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Workspace name is required.");
    createMutation.mutate();
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 pb-2 sm:gap-5">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)] sm:p-6">
        <div className="pointer-events-none absolute -right-14 -top-20 size-56 rounded-full bg-ember/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember">
              <Building2 className="size-3.5" /> Team spaces
            </div>
            <h1 className="font-display text-[24px] font-semibold tracking-[-0.045em] sm:text-[30px]">Workspaces</h1>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-(--text-secondary) sm:text-xs">
              Separate teams, projects and communities while keeping the SheyiHub experience consistent.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> New workspace</Button>
        </div>
      </section>

      {query.isLoading ? (
        <div className="grid min-h-64 place-items-center"><Loader2 className="size-6 animate-spin text-ember" /></div>
      ) : workspaces.length === 0 ? (
        <Card className="p-6 sm:p-10">
          <EmptyState
            icon={Building2}
            title="Create your first workspace"
            description="Use a workspace for a project, team, class or company. Tasks and members will live inside it."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create workspace</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-(--border) px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-(--text-secondary)">Your workspaces</p>
            </div>
            <div className="p-2">
              {workspaces.map((workspace) => {
                const RoleIcon = roleIcon(workspace.role);
                const selected = workspace.id === activeWorkspace?.id;
                return (
                  <button
                    key={workspace.id}
                    onClick={() => setActiveWorkspaceId(workspace.id)}
                    className={`mb-1 flex w-full items-center gap-3 rounded-[12px] p-3 text-left transition ${selected ? "bg-ember/10 ring-1 ring-ember/20" : "hover:bg-ember/[0.04]"}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-ember/20 to-purple-500/10 text-ember">
                      {workspace.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{workspace.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[9px] text-(--text-secondary)"><RoleIcon className="size-3" /> {workspace.role} · {workspace.member_count} members</span>
                    </span>
                    {selected ? <Check className="size-4 text-ember" /> : <ChevronRight className="size-4 text-(--text-secondary)" />}
                  </button>
                );
              })}
            </div>
          </Card>

          {activeWorkspace ? (
            <div className="flex min-w-0 flex-col gap-4">
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-xl font-semibold">{activeWorkspace.name}</h2>
                      <Badge tone="signal">{activeWorkspace.role}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-(--text-secondary)">{activeWorkspace.description || "No description yet."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="secondary" onClick={() => setMemberOpen(true)} disabled={activeWorkspace.role === "member"}><UserPlus className="size-4" /> Add member</Button>
                    <Button onClick={() => navigate("/tasks")}><Check className="size-4" /> Open tasks</Button>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="flex items-center justify-between border-b border-(--border) px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-xs font-semibold">Members</p>
                    <p className="mt-0.5 text-[9px] text-(--text-secondary)">People with access to this workspace</p>
                  </div>
                  <Badge>{membersQuery.data?.length ?? activeWorkspace.member_count}</Badge>
                </div>
                {membersQuery.isLoading ? (
                  <div className="grid min-h-44 place-items-center"><Loader2 className="size-5 animate-spin text-ember" /></div>
                ) : (
                  <div className="divide-y divide-(--border)">
                    {(membersQuery.data ?? []).map((member) => (
                      <div key={member.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <Avatar name={member.display_name} src={member.avatar_url} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{member.display_name}</p>
                          <p className="truncate text-[9px] text-(--text-secondary)">{member.email}</p>
                        </div>
                        <Badge tone={member.role === "owner" ? "signal" : "neutral"}>{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create workspace">
        <form className="space-y-4" onSubmit={createWorkspace}>
          <Input label="Workspace name" value={name} onChange={(e) => setName(e.target.value)} placeholder="AMBLE Team" autoFocus />
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this workspace for?" />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" isLoading={createMutation.isPending}>Create workspace</Button></div>
        </form>
      </Modal>

      <Modal isOpen={memberOpen} onClose={() => setMemberOpen(false)} title="Add workspace member">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!memberEmail.trim()) return toast.error("Enter an email address."); addMemberMutation.mutate(); }}>
          <Input label="Email" type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="teammate@example.com" autoFocus />
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold text-(--text-secondary)">Role</label>
            <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as WorkspaceRole)} className="h-11 w-full rounded-[11px] border border-(--border) bg-(--surface-soft) px-3 text-xs outline-none focus:border-ember">
              <option value="member">Member</option><option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setMemberOpen(false)}>Cancel</Button><Button type="submit" isLoading={addMemberMutation.isPending}>Add member</Button></div>
        </form>
      </Modal>
    </div>
  );
}
