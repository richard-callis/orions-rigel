"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

// Jackbox-style entry point: type the code an instructor read out, land
// straight in that module's Present Mode. Records attendance immediately
// on join so "how many people used the room code" is answerable even for
// someone who exits before reaching the last slide.
export function JoinRoom() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/live-sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode: code }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't join");
        return;
      }
      router.push(`/present/${body.courseSlug}/${body.moduleSlug}`);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised transition-colors cursor-pointer"
      >
        <KeyRound size={14} /> Join
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
        onBlur={() => {
          if (!code.trim()) setOpen(false);
        }}
        placeholder="ROOM CODE"
        maxLength={8}
        className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-mono uppercase tracking-wider placeholder:text-muted placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="submit"
        disabled={!code.trim() || pending}
        className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : "Go"}
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </form>
  );
}
