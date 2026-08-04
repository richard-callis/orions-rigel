import { Worker } from "node:worker_threads";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Server-side, authoritative grading for weekly SQL challenge submissions.
 *
 * Unlike the practice-console exercises (graded client-side, in the
 * browser's own PGlite instance, with the client just POSTing a `passed`
 * boolean it computed itself), this runs in a fresh in-memory PGlite
 * instance on the server for every submission. Nothing here is
 * client-reported — a leaderboard is a much stronger incentive to cheat
 * than a personal progress tracker, so correctness, runtimeMs, and
 * planCost all have to come from code the client can't influence.
 *
 * The actual PGlite work happens in grade-sql-worker.mjs, in its own
 * worker thread, not inline here. PGlite is synchronous WASM running
 * in-process — a Promise.race timeout around it does nothing, since the
 * event loop is blocked for the query's entire duration regardless (a
 * runaway submission, e.g. an unbounded cross join, was measured wedging
 * the whole Node process — every other request, not just this one — for
 * minutes). A worker thread is genuinely preemptible: worker.terminate()
 * kills it outright, and the rest of the server keeps serving requests
 * throughout. The worker is a separate plain-JS file, not a TS module
 * resolved through this project's path aliases, because worker_threads
 * needs a real file on disk and this project's runtime Docker image
 * copies compiled .next output plus src/generated, not the general src/
 * tree — grade-sql-worker.mjs is copied explicitly (see Dockerfile).
 *
 * gradingSchemaSql must be a dataset the student never sees — see the
 * WeeklyChallenge.hiddenSchemaSql doc comment for why using the same
 * data shown in the practice console would let a submission that just
 * hardcodes the answer's literal values pass.
 */

export type GradeResult = {
  passed: boolean;
  runtimeMs: number;
  planCost: number | null;
  errorMessage: string | null;
};

// worker.terminate() is the only real preemption available (see the doc
// comment above — an internal per-query timeout inside the worker can't
// preempt PGlite either, for the same reason a Promise.race around the
// whole thing didn't), so this one timeout necessarily bounds the worker's
// entire lifetime: spawn + two PGlite boots + checkQuery + the submission
// itself + EXPLAIN. That fixed overhead measured ~2.85s: budgeting only
// 5s total left a correct-but-not-trivial submission as little as ~2s of
// real query time before getting killed and reported as "timed out" —
// unfair to the student, not a meaningful cap on abuse either way, since
// runtimeMs (what's actually stored/shown) only ever measures the
// submission's own exec call, not this wrapper's overhead.
const GRADE_TIMEOUT_MS = 10_000;
const WORKER_PATH = path.join(process.cwd(), "src/lib/grade-sql-worker.mjs");

export async function gradeSqlSubmission(params: {
  gradingSchemaSql: string;
  checkQuery: string;
  requireOrder: boolean;
  submittedSql: string;
}): Promise<GradeResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: {
        schemaSql: params.gradingSchemaSql,
        checkQuery: params.checkQuery,
        requireOrder: params.requireOrder,
        submittedSql: params.submittedSql,
      },
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve({
        passed: false,
        runtimeMs: GRADE_TIMEOUT_MS,
        planCost: null,
        errorMessage: "Query timed out — check for an unbounded join or a missing WHERE clause.",
      });
    }, GRADE_TIMEOUT_MS);

    worker.on("message", (msg: { ok: true; result: GradeResult } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      if (msg.ok) {
        resolve(msg.result);
      } else {
        resolve({ passed: false, runtimeMs: 0, planCost: null, errorMessage: msg.error });
      }
    });

    worker.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ passed: false, runtimeMs: 0, planCost: null, errorMessage: err.message });
    });
  });
}

/**
 * Confirms schemaSql and hiddenSchemaSql actually produce different
 * checkQuery results. Nothing else enforces this — a challenge published
 * with identical data in both fields would pass every other check (the
 * solution genuinely does match checkQuery against "both" datasets,
 * because they're the same dataset) while silently reinstating the
 * hardcoded-literal cheat this field exists to prevent. Admin-triggered
 * (creation/generation), not per-student, so this runs PGlite directly
 * rather than through the worker-isolated path submissions use.
 */
export async function assertHiddenDatasetDiffers(params: {
  schemaSql: string;
  hiddenSchemaSql: string;
  checkQuery: string;
}): Promise<void> {
  async function run(schemaSql: string) {
    const db = new PGlite();
    try {
      await db.exec(schemaSql);
      const results = await db.exec(params.checkQuery);
      return JSON.stringify(results[0]?.rows ?? []);
    } finally {
      await db.close();
    }
  }

  const [publicResult, hiddenResult] = await Promise.all([run(params.schemaSql), run(params.hiddenSchemaSql)]);
  if (publicResult === hiddenResult) {
    throw new Error(
      "Hidden grading data produces the exact same checkQuery result as the public schema — it needs different row values, or grading against it would be as guessable as the public example.",
    );
  }
}
