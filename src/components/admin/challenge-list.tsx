"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";

export type AdminChallenge = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  weekOf: string;
  isActive: boolean;
  _count: { submissions: number };
};

export function ChallengeList({ initialChallenges }: { initialChallenges: AdminChallenge[] }) {
  const [challenges, setChallenges] = useState(initialChallenges);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(id: string, isActive: boolean) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't update that challenge.");
        return;
      }
      setChallenges((cs) => cs.map((c) => ({ ...c, isActive: c.id === id ? isActive : isActive ? false : c.isActive })));
    } finally {
      setPendingId(null);
    }
  }

  async function deleteChallenge(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenges/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't delete that challenge.");
        return;
      }
      setChallenges((cs) => cs.filter((c) => c.id !== id));
      setConfirmingId(null);
    } finally {
      setDeletingId(null);
    }
  }

  if (challenges.length === 0) {
    return <p className="text-muted">No challenges yet.</p>;
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {error && <p className="border-b border-border bg-error/10 px-4 py-2 text-sm text-error">{error}</p>}
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-raised">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Title</th>
            <th className="px-4 py-2 text-left font-medium">Difficulty</th>
            <th className="px-4 py-2 text-left font-medium">Week of</th>
            <th className="px-4 py-2 text-right font-medium">Solves</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-left font-medium sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-4 py-2.5">
                <Link href={`/challenges`} className="hover:text-accent transition-colors">
                  {c.title}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-foreground-secondary capitalize">{c.difficulty}</td>
              <td className="px-4 py-2.5 text-foreground-secondary font-mono">
                {new Date(c.weekOf).toLocaleDateString()}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground-secondary">{c._count.submissions}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(c.id, !c.isActive)}
                    disabled={pendingId === c.id}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      c.isActive
                        ? "bg-success/20 text-success hover:bg-success/30"
                        : "border border-border hover:bg-surface-raised"
                    }`}
                  >
                    {c.isActive ? "Active" : "Activate"}
                  </button>
                  {pendingId === c.id && <Loader2 size={14} className="animate-spin text-muted" />}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                {confirmingId === c.id ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => deleteChallenge(c.id)}
                      disabled={deletingId === c.id}
                      className="rounded-lg bg-error px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                    >
                      Confirm delete
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-raised transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(c.id)}
                    title="Delete challenge"
                    className="rounded-lg p-1.5 text-muted hover:bg-error/10 hover:text-error transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
