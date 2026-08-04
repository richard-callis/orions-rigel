"use client";

import { Trophy } from "lucide-react";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  runtimeMs: number;
  planCost: number | null;
  attempts: number;
  solvedAt: string;
};

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <Trophy size={24} className="mx-auto mb-2 text-muted" />
        <p className="text-sm text-foreground-secondary">No one&apos;s solved this one yet — be the first.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-raised">
          <tr>
            <th className="px-4 py-2 text-left font-medium w-12">#</th>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-right font-medium">Speed</th>
            <th className="px-4 py-2 text-right font-medium">Efficiency</th>
            <th className="px-4 py-2 text-right font-medium">Attempts</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.rank} className="border-t border-border">
              <td className="px-4 py-2.5 font-mono text-foreground-secondary">
                {MEDAL[e.rank] ?? e.rank}
              </td>
              <td className="px-4 py-2.5 font-medium">{e.name}</td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground-secondary">{e.runtimeMs}ms</td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground-secondary">
                {e.planCost !== null ? `${e.planCost.toFixed(1)} cost` : "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground-secondary">{e.attempts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
