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
 * Two independent defenses against a submission mutating the sandbox and
 * then having that mutation silently determine "correctness":
 *   1. checkQuery's expected result is computed FIRST, before the
 *      submission ever runs, from data the submission hasn't touched yet.
 *   2. The submission itself runs inside `BEGIN READ ONLY ... ROLLBACK`,
 *      which Postgres enforces for real — DELETE/UPDATE/INSERT/DDL, and
 *      critically data-modifying CTEs (`WITH d AS (DELETE ... RETURNING
 *      *) SELECT ...`), all get rejected by the database itself. This is
 *      the actual security boundary; isSelectOnly below is a fast,
 *      friendlier-error pre-check on top of it, not a substitute for it —
 *      a regex over SQL text can't reliably distinguish "select" appearing
 *      in a comment from a real keyword (a `--` inside a string literal is
 *      the classic trap), so it must never be the only thing standing
 *      between a submission and the database.
 */

export type GradeResult = {
  passed: boolean;
  runtimeMs: number;
  planCost: number | null;
  errorMessage: string | null;
};

const SUBMISSION_TIMEOUT_MS = 5000;

const SELECT_ONLY = /^\s*(with\b[\s\S]*?)?select\b/i;

// Strips -- and /* */ comments while tracking single-quoted string state,
// so `SELECT '--not a comment'` isn't mistaken for one ending mid-string.
// Doesn't handle every Postgres string-literal form (dollar-quoting,
// backslash escapes under standard_conforming_strings=off) — acceptable
// here because this function only feeds a pre-check with a friendlier
// error message; READ ONLY below is what actually enforces "no writes,"
// regardless of what this misses.
function stripSqlComments(sql: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += sql[i + 1];
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function isSelectOnly(sql: string): boolean {
  const stripped = stripSqlComments(sql).trim();
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

    // Computed before the submission ever runs — see module doc comment.
    const checkResults = await withTimeout(
      db.exec(params.checkQuery),
      SUBMISSION_TIMEOUT_MS,
      "checkQuery timed out",
    );
    const expectedRows = (checkResults[0]?.rows ?? []) as Row[];

    const start = performance.now();
    let submittedRows: Row[];
    try {
      // The real enforcement: Postgres rejects any write (including a
      // data-modifying CTE) inside a READ ONLY transaction, regardless of
      // whether isSelectOnly's text-level check would have caught it.
      const results = await withTimeout(
        db.exec(`BEGIN READ ONLY; ${params.submittedSql}; ROLLBACK;`),
        SUBMISSION_TIMEOUT_MS,
        "Query timed out — check for an unbounded join or a missing WHERE clause.",
      );
      submittedRows = (results[1]?.rows ?? []) as Row[];
    } catch (err) {
      // A rejected write surfaces here as a Postgres error (e.g. "cannot
      // execute DELETE in a read-only transaction") — that message is
      // clear enough to show as-is. The transaction is left aborted on
      // this connection either way, but the connection is discarded in
      // `finally` regardless, so nothing further is attempted on it.
      return {
        passed: false,
        runtimeMs: Math.round(performance.now() - start),
        planCost: null,
        errorMessage: err instanceof Error ? err.message : "Query failed to execute.",
      };
    }
    const runtimeMs = Math.round(performance.now() - start);

    // A fresh connection for EXPLAIN and the pass/fail comparison — the
    // one above may be left in an aborted-transaction state if the
    // submission's ROLLBACK didn't get a chance to run cleanly.
    const db2 = new PGlite();
    let planCost: number | null = null;
    try {
      await db2.exec(params.schemaSql);
      const explainResults = await db2.exec(`BEGIN READ ONLY; EXPLAIN (FORMAT JSON) ${params.submittedSql}; ROLLBACK;`);
      const plan = explainResults[1]?.rows[0] as { "QUERY PLAN"?: [{ Plan?: { "Total Cost"?: number } }] } | undefined;
      planCost = plan?.["QUERY PLAN"]?.[0]?.Plan?.["Total Cost"] ?? null;
    } catch {
      // Non-fatal — efficiency is a secondary/display-only metric.
      // Correctness and speed still stand even if this fails.
    } finally {
      await db2.close();
    }

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
