import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Modal } from "@/components/Modal";
import { chatsApi } from "@/features/chats/api";
import { ApiError } from "@/lib/apiClient";

export function NewConversationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: chatsApi.startConversation,
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setEmails([]);
      onClose();
      navigate(`/chats/${conversation.id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong."),
  });

  function addEmail(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const email = input.trim().replace(/,$/, "");
    if (email && !emails.includes(email)) setEmails([...emails, email]);
    setInput("");
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New conversation">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5 rounded-md border border-(--border) bg-(--surface-raised) p-2">
          {emails.map((email) => (
            <span
              key={email}
              className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs dark:bg-white/10"
            >
              {email}
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => setEmails(emails.filter((e) => e !== email))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={addEmail}
            placeholder="Type an email, press Enter"
            className="min-w-32 flex-1 bg-transparent text-sm outline-none"
            autoFocus
          />
        </div>
        {error ? <ErrorBanner message={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={emails.length === 0}
            onClick={() => {
              setError(null);
              mutation.mutate(emails);
            }}
          >
            Start
          </Button>
        </div>
      </div>
    </Modal>
  );
}
