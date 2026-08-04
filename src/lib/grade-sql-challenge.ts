import { Worker } from "node:worker_threads";
import path from "node:path";

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

const GRADE_TIMEOUT_MS = 5000;
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
