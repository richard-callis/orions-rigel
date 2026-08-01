"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Radio, Users } from "lucide-react";
import { useLessonMeta } from "@/lib/lesson-meta-context";

type StatusResponse = {
  active: { id: string; activatedAt: string; closedAt: string | null } | null;
  tally: number[];
  total: number;
  myResponse: number | null;
};

export function Quiz({
  id,
  question,
  options,
  answer,
}: {
  id: string;
  question: string;
  options: string[];
  answer: number;
}) {
  const { courseSlug, moduleSlug } = useLessonMeta();
  const { data: authSession, status: authStatus } = useSession();
  const isInstructor = authSession?.user?.role === "INSTRUCTOR";

  const [state, setState] = useState<StatusResponse | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function poll() {
      const res = await fetch(
        `/api/quizzes/status?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}&quizKey=${encodeURIComponent(id)}`
      );
      if (res.ok && !ignore) setState(await res.json());
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [courseSlug, moduleSlug, id]);

  const active = state?.active ?? null;
  const isOpen = Boolean(active && !active.closedAt);
  const myResponse = state?.myResponse ?? null;
  const answered = myResponse !== null;
  const revealed = answered || Boolean(active?.closedAt);

  async function activate() {
    setPending(true);
    try {
      const res = await fetch("/api/quizzes/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, moduleSlug, quizKey: id }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  async function close() {
    if (!active) return;
    setPending(true);
    try {
      const res = await fetch("/api/quizzes/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeQuizId: active.id }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  async function respond(index: number) {
    if (!active || !isOpen || answered) return;
    setPending(true);
    try {
      const res = await fetch("/api/quizzes/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeQuizId: active.id, selectedIndex: index }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow flex items-center gap-1.5">
          <Radio size={12} className={isOpen ? "text-error animate-pulse" : ""} />
          {isOpen ? "Live quiz" : "Quiz"}
        </p>
        {state && state.total > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted font-mono">
            <Users size={12} /> {state.total}
          </span>
        )}
      </div>

      <p className="font-medium mb-4">{question}</p>

      <div className="space-y-2">
        {options.map((opt, i) => {
          const isMine = myResponse === i;
          const isCorrect = i === answer;
          const count = state?.tally?.[i] ?? 0;
          const pct = state && state.total > 0 ? Math.round((count / state.total) * 100) : 0;

          return (
            <button
              key={i}
              onClick={() => respond(i)}
              disabled={!isOpen || answered || pending || authStatus !== "authenticated"}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                revealed && isCorrect
                  ? "border-success/40 bg-success/10"
                  : revealed && isMine
                    ? "border-error/40 bg-error/10"
                    : "border-border"
              } ${isOpen && !answered ? "hover:bg-surface-raised cursor-pointer" : "cursor-default"}`}
            >
              {revealed && (
                <div className="absolute inset-y-0 left-0 bg-border/50" style={{ width: `${pct}%` }} />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {revealed && isCorrect && <CheckCircle2 size={14} className="text-success shrink-0" />}
                  {revealed && isMine && !isCorrect && <XCircle size={14} className="text-error shrink-0" />}
                  {opt}
                </span>
                {revealed && <span className="text-xs text-muted font-mono shrink-0">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!active && !isInstructor && (
        <p className="mt-3 text-xs text-muted">Waiting for the instructor to start this quiz.</p>
      )}
      {authStatus !== "authenticated" && !isInstructor && (
        <p className="mt-3 text-xs text-muted">Sign in to answer.</p>
      )}

      {isInstructor && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          {!active || active.closedAt ? (
            <button
              onClick={activate}
              disabled={pending}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              Activate quiz
            </button>
          ) : (
            <button
              onClick={close}
              disabled={pending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-raised transition-colors cursor-pointer disabled:opacity-50"
            >
              Close quiz
            </button>
          )}
        </div>
      )}
    </div>
  );
}
