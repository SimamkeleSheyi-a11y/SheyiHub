import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, File as FileIcon, FileImage, FileText, Loader2, Paperclip, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { filesApi } from "@/features/files/api";
import { ApiError } from "@/lib/apiClient";
import { wsClient } from "@/lib/wsClient";
import { toast } from "@/stores/toastStore";
import type { SharedFile } from "@/types/file";

const MAX_BYTES = 25 * 1024 * 1024;

function iconFor(file: SharedFile) {
  if (file.content_type.startsWith("image/")) return FileImage;
  if (file.content_type === "application/pdf" || file.content_type.startsWith("text/")) return FileText;
  return FileIcon;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileSharePanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [preview, setPreview] = useState<{ file: SharedFile; url: string } | null>(null);
  const query = useQuery({ queryKey: ["shared-files", conversationId], queryFn: () => filesApi.list(conversationId) });
  const files = Array.isArray(query.data) ? query.data : (query.data?.results ?? []);

  useEffect(() => wsClient.on("file.shared", (event) => {
    if (event.conversation_id === conversationId) queryClient.invalidateQueries({ queryKey: ["shared-files", conversationId] });
  }), [conversationId, queryClient]);

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error("Files must be 25 MB or smaller."); return; }
    setUploadName(file.name); setUploadProgress(0);
    try {
      await filesApi.upload(conversationId, file, setUploadProgress);
      await queryClient.invalidateQueries({ queryKey: ["shared-files", conversationId] });
      toast.success(`${file.name} shared.`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "File upload failed.");
    } finally {
      setUploadProgress(null); setUploadName("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openPreview(file: SharedFile) {
    try {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const blob = await filesApi.downloadBlob(file.id, true);
      setPreview({ file, url: URL.createObjectURL(blob) });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Preview failed."); }
  }

  async function download(file: SharedFile) {
    try {
      const blob = await filesApi.downloadBlob(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = file.filename;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Download failed."); }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files?.[0]); }}
        className={`mb-3 rounded-xl border border-dashed p-4 text-center transition ${dragging ? "border-ember bg-ember/10" : "border-(--border) bg-black/5 dark:bg-white/5"}`}
      >
        <UploadCloud className="mx-auto mb-2 size-6 text-ember" />
        <p className="text-sm font-medium text-(--text-primary)">Drop a file here</p>
        <p className="mt-1 text-xs text-(--text-secondary)">Images, PDF, text/CSV and Office files · max 25 MB</p>
        <button onClick={() => inputRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ember px-3 py-1.5 text-xs font-semibold text-stone-950">
          <Paperclip className="size-3.5" /> Choose file
        </button>
      </div>

      {uploadProgress !== null ? (
        <div className="mb-3 rounded-lg bg-black/5 p-3 text-xs dark:bg-white/5">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-(--text-primary)">{uploadName}</span><span className="text-(--text-secondary)">{uploadProgress}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-ember transition-all" style={{ width: `${uploadProgress}%` }} /></div>
        </div>
      ) : null}

      {query.isLoading ? <div className="flex flex-1 items-center justify-center text-(--text-secondary)"><Loader2 className="size-5 animate-spin" /></div>
      : query.isError ? <ErrorBanner message="Shared files couldn't be loaded." />
      : files.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center p-5 text-center text-(--text-secondary)"><Paperclip className="mb-2 size-7 opacity-60" /><p className="text-sm">No files have been shared yet.</p></div>
      : <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {files.map((file) => { const Icon = iconFor(file); return (
            <div key={file.id} className="rounded-xl border border-(--border) bg-black/5 p-3 dark:bg-white/5">
              <div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ember/10 text-ember"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-(--text-primary)" title={file.filename}>{file.filename}</p><p className="mt-0.5 text-[11px] text-(--text-secondary)">{formatBytes(file.size_bytes)} · {file.uploader.display_name} · {new Date(file.uploaded_at).toLocaleString()}</p></div></div>
              <div className="mt-2 flex gap-2">{file.previewable ? <button onClick={() => void openPreview(file)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ember hover:bg-ember/10"><Eye className="size-3.5" /> Preview</button> : null}<button onClick={() => void download(file)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-(--text-secondary) hover:bg-black/5 dark:hover:bg-white/5"><Download className="size-3.5" /> Download</button></div>
            </div>
          ); })}
        </div>}

      {preview ? <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}><div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-stone-950 shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white"><span className="truncate text-sm font-medium">{preview.file.filename}</span><button onClick={() => setPreview(null)} aria-label="Close preview" className="rounded-md p-1 hover:bg-white/10"><X className="size-5" /></button></div><div className="min-h-0 flex-1 overflow-auto bg-black/30 p-3">{preview.file.content_type.startsWith("image/") ? <img src={preview.url} alt={preview.file.filename} className="mx-auto max-h-[78vh] max-w-full object-contain" /> : <iframe src={preview.url} title={preview.file.filename} className="h-[78vh] w-full rounded bg-white" />}</div></div></div> : null}
    </div>
  );
}
