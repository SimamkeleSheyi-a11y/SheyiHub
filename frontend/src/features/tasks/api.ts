import { apiFetch } from "@/lib/apiClient";
import type { TaskPriority, TaskStatus, WorkspaceTask } from "@/types/task";

interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TaskInput {
  workspace: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  position?: number;
}

export const tasksApi = {
  list: (workspaceId: string) => apiFetch<Page<WorkspaceTask> | WorkspaceTask[]>(`/tasks/?workspace=${workspaceId}`),
  create: (data: TaskInput) => apiFetch<WorkspaceTask>("/tasks/", { method: "POST", body: data }),
  update: (id: string, data: Partial<TaskInput>) =>
    apiFetch<WorkspaceTask>(`/tasks/${id}/`, { method: "PATCH", body: data }),
  remove: (id: string) => apiFetch<void>(`/tasks/${id}/`, { method: "DELETE" }),
};
