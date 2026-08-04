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
 */

export type GradeResult = {
  passed: boolean;
  runtimeMs: number;
  planCost: number | null;
  errorMessage: string | null;
};

const SUBMISSION_TIMEOUT_MS = 5000;

// Only a single read-only SELECT (or WITH ... SELECT) statement is allowed.
// This is a judge for query-writing skill, not a general-purpose sandbox —
// restricting to one SELECT closes off stacked-statement tricks entirely,
// on top of the fact that each grading run already gets its own disposable
// in-memory database that nothing else ever touches.
const SELECT_ONLY = /^\s*(with\b[\s\S]*?)?select\b/i;

function isSelectOnly(sql: string): boolean {
  const stripped = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  if (!stripped) return false;
  const withoutTrailingSemicolon = stripped.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) return false; // stacked statements
  return SELECT_ONLY.test(withoutTrailingSemicolon);
}

type Row = Record<string, unknown>;

// Order-insensitive by default: stringify each row's entries sorted by
// column name, so column order in the SELECT list doesn't matter, then
// compare as multisets (or in-order if the challenge requires it).
function normalizeRow(row: Row): string {
  return JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
}

function resultsMatch(expected: Row[], actual: Row[], requireOrder: boolean): boolean {
  if (expected.length !== actual.length) return false;
  const expectedNorm = expected.map(normalizeRow);
  const actualNorm = actual.map(normalizeRow);
  if (requireOrder) {
    return expectedNorm.every((r, i) => r === actualNorm[i]);
  }
  const a = [...expectedNorm].sort();
  const b = [...actualNorm].sort();
  return a.every((r, i) => r === b[i]);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function gradeSqlSubmission(params: {
  schemaSql: string;
  checkQuery: string;
  requireOrder: boolean;
  submittedSql: string;
}): Promise<GradeResult> {
  if (!isSelectOnly(params.submittedSql)) {
    return {
      passed: false,
      runtimeMs: 0,
      planCost: null,
      errorMessage: "Only a single SELECT (or WITH ... SELECT) statement is allowed.",
    };
  }

  const db = new PGlite();
  try {
    try {
      await withTimeout(db.exec(params.schemaSql), SUBMISSION_TIMEOUT_MS, "Sandbox setup timed out");
    } catch (err) {
      // A broken schemaSql is an authoring bug, not the student's fault —
      // surface it distinctly so an instructor notices, not so a student
      // thinks their query is wrong.
      throw new Error(
        `Challenge sandbox failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const start = performance.now();
    let submittedRows: Row[];
    try {
      const results = await withTimeout(
        db.exec(params.submittedSql),
        SUBMISSION_TIMEOUT_MS,
        "Query timed out — check for an unbounded join or a missing WHERE clause.",
      );
      submittedRows = (results[0]?.rows ?? []) as Row[];
    } catch (err) {
      return {
        passed: false,
        runtimeMs: Math.round(performance.now() - start),
        planCost: null,
        errorMessage: err instanceof Error ? err.message : "Query failed to execute.",
      };
    }
    const runtimeMs = Math.round(performance.now() - start);

    let planCost: number | null = null;
    try {
      const explainResults = await db.exec(`EXPLAIN (FORMAT JSON) ${params.submittedSql}`);
      const plan = explainResults[0]?.rows[0] as { "QUERY PLAN"?: [{ Plan?: { "Total Cost"?: number } }] } | undefined;
      planCost = plan?.["QUERY PLAN"]?.[0]?.Plan?.["Total Cost"] ?? null;
    } catch {
      // Non-fatal — efficiency is a secondary/display-only metric.
      // Correctness and speed still stand even if this fails.
    }

    const checkResults = await db.exec(params.checkQuery);
    const expectedRows = (checkResults[0]?.rows ?? []) as Row[];

    const passed = resultsMatch(expectedRows, submittedRows, params.requireOrder);

    return {
      passed,
      runtimeMs,
      planCost,
      errorMessage: passed ? null : "Your query's results don't match the expected output.",
    };
  } finally {
    await db.close();
  }
}
