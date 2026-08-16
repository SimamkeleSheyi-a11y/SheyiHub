export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMember {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  role: WorkspaceRole;
  joined_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  role: WorkspaceRole;
  member_count: number;
  created_at: string;
  updated_at: string;
}
