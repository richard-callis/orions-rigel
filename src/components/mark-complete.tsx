"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Check, Circle, Loader2 } from "lucide-react";

export function MarkComplete({
  courseSlug,
  moduleSlug,
  initiallyCompleted,
}: {
  courseSlug: string;
  moduleSlug: string;
  initiallyCompleted: boolean;
}) {
  const { status } = useSession();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [pending, setPending] = useState(false);

  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <Link href="/login" className="text-sm text-accent hover:underline">
        Sign in to track progress
      </Link>
    );
  }

  async function toggle() {
    setPending(true);
    const next = !completed;
    try {
      await fetch("/api/progress", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, moduleSlug }),
      });
      setCompleted(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
        completed
          ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
          : "border-border hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : completed ? (
        <Check size={14} />
      ) : (
        <Circle size={14} />
      )}
      {completed ? "Completed" : "Mark as complete"}
    </button>
  );
}
