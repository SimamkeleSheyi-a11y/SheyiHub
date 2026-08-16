export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface WorkspaceTask {
  id: string;
  workspace: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assignee: {
    id: string;
    display_name: string;
    avatar_url: string;
    email: string;
  } | null;
  created_by_name: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}
