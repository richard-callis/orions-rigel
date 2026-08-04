// Runs the actual PGlite grading work for a weekly-challenge submission,
// in its own worker thread so a runaway query (deliberate or accidental —
// an unbounded cross join, say) can be killed with worker.terminate()
// instead of freezing the whole Node process. See grade-sql-challenge.ts,
// which spawns this and enforces the timeout; this file only ever runs
// inside a worker, driven by the message protocol below.
//
// Deliberately plain ESM with no project imports (no `@/...` aliases, no
// TypeScript) and no dependency beyond @electric-sql/pglite (already in
// node_modules at runtime) — worker_threads needs a real file on disk to
// point at, and this project's runtime Docker image copies compiled
// .next output plus src/generated, not the general src/ tree, so this
// file is copied explicitly (see Dockerfile) rather than resolved through
// Next's bundler.

import { parentPort, workerData } from "node:worker_threads";
import { PGlite } from "@electric-sql/pglite";

const SELECT_ONLY = /^\s*(with\b[\s\S]*?)?select\b/i;

// Strips comments AND blanks out string-literal contents (replacing each
// character inside a string with "x", keeping the quotes) — a semicolon or
// keyword inside a string body is syntactically inert and shouldn't affect
// either the stacked-statement check or the SELECT_ONLY match below. A
// naive strip that left string contents untouched would still wrongly
// reject legitimate queries like `SELECT 'a;b'` as a stacked statement.
function stripCommentsAndStrings(sql) {
  let out = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += "xx";
          i++;
        } else {
          inString = false;
          out += ch;
        }
      } else {
        out += "x";
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

function isSelectOnly(sql) {
  const stripped = stripCommentsAndStrings(sql).trim();
  if (!stripped) return false;
  const withoutTrailingSemicolon = stripped.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) return false;
  return SELECT_ONLY.test(withoutTrailingSemicolon);
}

function normalizeRow(row) {
  return JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
}

function resultsMatch(expected, actual, requireOrder) {
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

async function grade({ schemaSql, checkQuery, requireOrder, submittedSql }) {
  if (!isSelectOnly(submittedSql)) {
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
      await db.exec(schemaSql);
    } catch (err) {
      throw new Error(`Challenge sandbox failed to initialize: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Computed before the submission ever runs, so a submission that
    // somehow mutates the sandbox (see grade-sql-challenge.ts's module
    // comment) can't retroactively change what "correct" means.
    const checkResults = await db.exec(checkQuery);
    const expectedRows = checkResults[0]?.rows ?? [];

    const start = performance.now();
    let submittedRows;
    try {
      const results = await db.exec(`BEGIN READ ONLY; ${submittedSql}; ROLLBACK;`);
      submittedRows = results[1]?.rows ?? [];
    } catch (err) {
      // Never echo the raw Postgres error back to the client. Postgres
      // routinely embeds the offending VALUE in error text (e.g. a failed
      // type cast reports what it tried to cast) — since the submission
      // runs against hiddenSchemaSql, a query engineered to fail in a
      // data-dependent way (cast a real column's value to a type that'll
      // reject it, forcing the value into the error message) turns this
      // into a read oracle over data the student is never supposed to
      // see, one submission at a time. Logged server-side for debugging;
      // the client only ever gets a fixed, content-free message.
      console.error("[grade-sql-worker] submission execution failed:", err);
      return {
        passed: false,
        runtimeMs: Math.round(performance.now() - start),
        planCost: null,
        errorMessage: "Your query failed to execute. Check its syntax and try again.",
      };
    }
    const runtimeMs = Math.round(performance.now() - start);

    const db2 = new PGlite();
    let planCost = null;
    try {
      await db2.exec(schemaSql);
      const explainResults = await db2.exec(`BEGIN READ ONLY; EXPLAIN (FORMAT JSON) ${submittedSql}; ROLLBACK;`);
      const plan = explainResults[1]?.rows[0];
      planCost = plan?.["QUERY PLAN"]?.[0]?.Plan?.["Total Cost"] ?? null;
    } catch {
      // Non-fatal — efficiency is a secondary/display-only metric.
    } finally {
      await db2.close();
    }

    const passed = resultsMatch(expectedRows, submittedRows, requireOrder);

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

grade(workerData)
  .then((result) => parentPort.postMessage({ ok: true, result }))
  .catch((err) => parentPort.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) }));
