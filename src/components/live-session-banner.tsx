"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Radio } from "lucide-react";

type LiveNow = {
  id: string;
  courseSlug: string;
  moduleSlug: string;
  roomCode: string;
  startedAt: string;
};

// Site-wide banner: polls for any currently-live session and surfaces it on
// every page, not just the course/module it's happening in — otherwise a
// student has no way to discover a session started unless they're already
// sitting on that exact page. Shown to signed-in users only (Present Mode
// itself requires sign-in to attend).
export function LiveSessionBanner() {
  const { status } = useSession();
  const [sessions, setSessions] = useState<LiveNow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "authenticated") return;

    let ignore = false;
    async function poll() {
      const res = await fetch("/api/live-sessions");
      if (res.ok && !ignore) {
        const body = await res.json();
        setSessions(body.sessions ?? []);
      }
    }
    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [status]);

  const visible = sessions.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b border-error/20 bg-error/10">
      {visible.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-center gap-3 px-4 py-2 text-xs text-error"
        >
          <Radio size={12} className="animate-pulse shrink-0" />
          <span>
            Live now: <span className="font-medium">{s.courseSlug}</span> ·{" "}
            {s.moduleSlug} · room{" "}
            <span className="font-mono font-semibold tracking-wider">{s.roomCode}</span>
          </span>
          <Link
            href={`/present/${s.courseSlug}/${s.moduleSlug}`}
            className="rounded border border-error/30 px-2 py-0.5 font-medium hover:bg-error/20 transition-colors"
          >
            Join
          </Link>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
            className="text-error/60 hover:text-error transition-colors"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
