import { ApiError, apiFetch } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import type { SharedFile } from "@/types/file";

interface Paginated<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

function uploadError(xhr: XMLHttpRequest) {
  try {
    const body = JSON.parse(xhr.responseText || "{}");
    const errors = body.errors as Record<string, string[]> | undefined;
    return new ApiError(xhr.status, errors?.file?.[0] ?? body.detail ?? "File upload failed.", body.code, errors);
  } catch {
    return new ApiError(xhr.status, "File upload failed.");
  }
}

export const filesApi = {
  list: (conversationId: string) =>
    apiFetch<Paginated<SharedFile> | SharedFile[]>(`/conversations/${conversationId}/files`),

  upload: (conversationId: string, file: File, onProgress?: (percent: number) => void): Promise<SharedFile> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE_URL}/conversations/${conversationId}/files`);
      xhr.withCredentials = true;
      const token = useAuthStore.getState().accessToken;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(JSON.parse(xhr.responseText) as SharedFile);
        } else reject(uploadError(xhr));
      };
      xhr.onerror = () => reject(new ApiError(0, "Network connection lost during upload.", "network"));
      const data = new FormData();
      data.append("file", file);
      xhr.send(data);
    }),

  downloadBlob: async (fileId: string, inline = false) => {
    const token = useAuthStore.getState().accessToken;
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/files/${fileId}/download${inline ? "?inline=1" : ""}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError(0, "Network connection lost while downloading the file.", "network");
    }
    if (!response.ok) throw new ApiError(response.status, "The file couldn't be downloaded.");
    return response.blob();
  },
};
