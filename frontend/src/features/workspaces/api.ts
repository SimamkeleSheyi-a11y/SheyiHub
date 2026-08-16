import { apiFetch } from "@/lib/apiClient";
import type { Workspace, WorkspaceMember, WorkspaceRole } from "@/types/workspace";

interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const workspacesApi = {
  list: () => apiFetch<Page<Workspace> | Workspace[]>("/workspaces/"),
  create: (data: { name: string; description?: string }) =>
    apiFetch<Workspace>("/workspaces/", { method: "POST", body: data }),
  detail: (id: string) => apiFetch<Workspace>(`/workspaces/${id}/`),
  update: (id: string, data: { name?: string; description?: string }) =>
    apiFetch<Workspace>(`/workspaces/${id}/`, { method: "PATCH", body: data }),
  remove: (id: string) => apiFetch<void>(`/workspaces/${id}/`, { method: "DELETE" }),
  members: (id: string) => apiFetch<WorkspaceMember[]>(`/workspaces/${id}/members/`),
  addMember: (id: string, data: { email: string; role?: WorkspaceRole }) =>
    apiFetch<WorkspaceMember>(`/workspaces/${id}/members/`, { method: "POST", body: data }),
  updateMember: (id: string, memberId: string, role: WorkspaceRole) =>
    apiFetch<WorkspaceMember>(`/workspaces/${id}/members/${memberId}/`, {
      method: "PATCH",
      body: { role },
    }),
  removeMember: (id: string, memberId: string) =>
    apiFetch<void>(`/workspaces/${id}/members/${memberId}/`, { method: "DELETE" }),
};
