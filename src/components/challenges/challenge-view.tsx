"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Loader2, Trophy } from "lucide-react";
import { ChallengeConsole } from "./challenge-console";
import { LeaderboardTable, type LeaderboardEntry } from "./leaderboard-table";

type Challenge = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  schemaSql: string;
  weekOf: string;
};

type SubmitResult = {
  passed: boolean;
  runtimeMs: number;
  planCost: number | null;
  errorMessage: string | null;
  attempts: number;
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-error",
};

export function ChallengeView({
  challenge,
  descriptionSlot,
}: {
  challenge: Challenge;
  /**
   * Rendered server-side (see challenges/page.tsx) and passed down as
   * already-rendered JSX, not rendered here — MDXRemote (from
   * next-mdx-remote/rsc, used by ChallengeDescription) is an async
   * Server Component and can't run inside a "use client" module. This
   * is the standard Next.js pattern for that: render the RSC in the
   * server-component parent, thread it through the client component as
   * a prop/children rather than importing it directly here.
   */
  descriptionSlot: ReactNode;
}) {
  const { data: session, status: authStatus } = useSession();

  const [initialSql, setInitialSql] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  async function loadLeaderboard() {
    const res = await fetch(`/api/challenges/leaderboard?challengeId=${encodeURIComponent(challenge.id)}`);
    if (res.ok) {
      const body = await res.json();
      setLeaderboard(body.leaderboard);
    }
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/api/challenges/leaderboard?challengeId=${encodeURIComponent(challenge.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!ignore && body) setLeaderboard(body.leaderboard);
      });
    return () => {
      ignore = true;
    };
  }, [challenge.id]);

  // Restore the signed-in user's last submission, if any, so they don't
  // start from a blank editor every visit.
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch(`/api/challenges/current`)
      .then((r) => r.json())
      .then((body) => {
        if (body.mySubmission) {
          setInitialSql(body.mySubmission.sql);
          setResult({
            passed: body.mySubmission.passed,
            runtimeMs: body.mySubmission.runtimeMs,
            planCost: body.mySubmission.planCost,
            errorMessage: body.mySubmission.errorMessage,
            attempts: body.mySubmission.attempts,
          });
        }
      })
      .catch(() => {});
  }, [authStatus]);

  async function handleSubmit(sql: string) {
    if (authStatus !== "authenticated") {
      setResult({ passed: false, runtimeMs: 0, planCost: null, errorMessage: "Sign in to submit.", attempts: 0 });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, sql }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ passed: false, runtimeMs: 0, planCost: null, errorMessage: body.error ?? "Submission failed", attempts: 0 });
        return;
      }
      setResult(body);
      if (body.passed) loadLeaderboard();
    } catch {
      setResult({ passed: false, runtimeMs: 0, planCost: null, errorMessage: "Submission failed. Try again.", attempts: 0 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8">
      <div className="space-y-6">
        <div>
          <p className={`eyebrow mb-1 ${DIFFICULTY_COLOR[challenge.difficulty] ?? ""}`}>
            {challenge.difficulty} · Week of {new Date(challenge.weekOf).toLocaleDateString()}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">{challenge.title}</h1>
        </div>

        {descriptionSlot}

        {session?.user ? null : (
          <p className="text-sm text-muted rounded-lg border border-border bg-surface px-3 py-2">
            Sign in to submit and appear on the leaderboard.
          </p>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-accent" />
            <h2 className="text-lg font-semibold">Leaderboard</h2>
          </div>
          {leaderboard ? (
            <LeaderboardTable entries={leaderboard} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-[420px]">
          <ChallengeConsole
            schemaSql={challenge.schemaSql}
            initialSql={initialSql}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>

        {result && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              result.passed ? "border-success/30 bg-success/5" : "border-error/30 bg-error/5"
            }`}
          >
            <div className="flex items-center gap-2 font-medium mb-1">
              {result.passed ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <XCircle size={16} className="text-error" />
              )}
              {result.passed ? "Correct!" : "Not quite"}
            </div>
            {result.passed ? (
              <p className="text-foreground-secondary">
                {result.runtimeMs}ms
                {result.planCost !== null && ` · ${result.planCost.toFixed(1)} plan cost`}
                {result.attempts > 0 && ` · ${result.attempts} attempt${result.attempts === 1 ? "" : "s"}`}
              </p>
            ) : (
              result.errorMessage && (
                <p className="text-foreground-secondary font-mono text-xs whitespace-pre-wrap">
                  {result.errorMessage}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
