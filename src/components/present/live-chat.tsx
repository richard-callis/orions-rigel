"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquare, Send, Users } from "lucide-react";

type ChatMessage = {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
};

// The running Twitch-style chat feed + live viewer count for a session.
// Separate from LiveQA (the curated, upvoted question queue) — this is the
// unfiltered firehose alongside the slides.
export function LiveChat({ liveSessionId }: { liveSessionId: string }) {
  const { data: authSession } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lastTimestampRef = useRef<string | null>(null);

  // Presence heartbeat — keeps this viewer counted as "watching."
  useEffect(() => {
    if (!authSession?.user) return;
    let ignore = false;
    async function beat() {
      if (!ignore) {
        fetch(`/api/live-sessions/${liveSessionId}/presence`, { method: "POST" });
      }
    }
    beat();
    const interval = setInterval(beat, 15000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [liveSessionId, authSession?.user]);

  // Poll the viewer count regardless of chat panel open/closed.
  useEffect(() => {
    let ignore = false;
    async function poll() {
      const res = await fetch(`/api/live-sessions/${liveSessionId}/presence`);
      if (res.ok && !ignore) {
        const body = await res.json();
        setViewerCount(body.count ?? 0);
      }
    }
    poll();
    const interval = setInterval(poll, 8000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [liveSessionId]);

  // Poll chat, using a cursor after the first load so we're not re-fetching
  // the whole history every few seconds.
  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    async function poll() {
      const after = lastTimestampRef.current;
      const url = after
        ? `/api/live-sessions/${liveSessionId}/chat?after=${encodeURIComponent(after)}`
        : `/api/live-sessions/${liveSessionId}/chat`;
      const res = await fetch(url);
      if (res.ok && !ignore) {
        const body = await res.json();
        const incoming: ChatMessage[] = body.messages ?? [];
        if (incoming.length > 0) {
          lastTimestampRef.current = incoming[incoming.length - 1].createdAt;
          setMessages((prev) => (after ? [...prev, ...incoming] : incoming));
        }
      }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [isOpen, liveSessionId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/live-sessions/${liveSessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed bottom-6 left-6 w-72 flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex items-center justify-between rounded-lg bg-surface-raised border border-border px-3 py-2 text-xs font-medium hover:bg-surface transition-colors"
      >
        <span className="flex items-center gap-2">
          <MessageSquare size={14} /> Chat
        </span>
        <span className="flex items-center gap-1 text-muted">
          <Users size={12} /> {viewerCount}
        </span>
      </button>

      {isOpen && (
        <div className="rounded-lg border border-border bg-surface flex flex-col h-72">
          <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 p-3">
            {messages.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No messages yet</p>
            ) : (
              messages.map((m) => (
                <p key={m.id} className="text-xs leading-snug break-words">
                  <span className="font-medium text-accent">{m.userName}</span>{" "}
                  <span className="text-foreground-secondary">{m.text}</span>
                </p>
              ))
            )}
          </div>
          {authSession?.user ? (
            <form onSubmit={send} className="border-t border-border p-2 flex gap-1.5">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something..."
                maxLength={300}
                disabled={submitting}
                className="flex-1 bg-surface-raised border border-border rounded px-2 py-1.5 text-xs placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!text.trim() || submitting}
                className="flex items-center justify-center rounded bg-accent px-2 py-1.5 text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={12} />
              </button>
            </form>
          ) : (
            <div className="border-t border-border p-2 text-xs text-muted">Sign in to chat</div>
          )}
        </div>
      )}
    </div>
  );
}
