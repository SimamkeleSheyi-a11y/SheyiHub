import type { User } from "./user";

export interface SharedFile {
  id: string;
  conversation: string;
  uploader: User;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  previewable: boolean;
}
