"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { Play, Send, RotateCcw, Loader2 } from "lucide-react";
import type { PGlite } from "@electric-sql/pglite";

type QueryResult = {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
};

/**
 * A dedicated console for the weekly challenge page — same CodeMirror +
 * "Run" pattern as the practice-console SqlConsole, but sourced from a
 * per-challenge schemaSql instead of a static file, and with a "Submit"
 * action that hands the current SQL off to the caller for server-side
 * grading. "Run" here is scratch/exploration only, same as everywhere
 * else in the app — it never determines pass/fail; only the parent's
 * onSubmit (POST /api/challenges/submit) is authoritative.
 */
export function ChallengeConsole(props: {
  schemaSql: string;
  initialSql?: string;
  onSubmit: (sql: string) => void;
  submitting: boolean;
}) {
  // Query text lives here, not in ConsoleBody, so it survives a reset —
  // "Reset" should restart the sandbox, not discard what the user typed.
  const [code, setCode] = useState(props.initialSql ?? "");
  // "Reset" remounts ConsoleBody via key rather than re-running an effect
  // with schemaSql in its dependency array — a mount effect that depends on
  // a prop trips this project's stricter set-state-in-effect lint rule (see
  // ConsoleBody's comment); a key change sidesteps it entirely, cleanly.
  const [resetKey, setResetKey] = useState(0);
  return (
    <ConsoleBody
      key={resetKey}
      {...props}
      code={code}
      setCode={setCode}
      onReset={() => setResetKey((k) => k + 1)}
    />
  );
}

function ConsoleBody({
  schemaSql,
  code,
  setCode,
  onSubmit,
  submitting,
  onReset,
}: {
  schemaSql: string;
  code: string;
  setCode: (v: string) => void;
  onSubmit: (sql: string) => void;
  submitting: boolean;
  onReset: () => void;
}) {
  const dbRef = useRef<PGlite | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [initError, setInitError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // ConsoleBody is remounted (fresh schemaSql, fresh state) via the `key` on
  // ChallengeConsole's reset button rather than this effect ever re-running
  // with a changed schemaSql — so it's genuinely mount-only despite reading
  // a prop, and initDb intentionally has no dependencies.
  const initDb = useCallback(async () => {
    setStatus("loading");
    setInitError(null);
    try {
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite();
      await db.exec(schemaSql);
      dbRef.current = db;
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setInitError(err instanceof Error ? err.message : String(err));
    }
  }, [schemaSql]);

  useEffect(() => {
    // Setting "loading" synchronously here is the point, not a bug this
    // component should route around: the sandbox genuinely isn't ready yet
    // and the UI needs to say so before the async PGlite import resolves.
    // Unlike SqlConsole (which loads one static, unchanging schema.sql and
    // so has zero reactive dependencies at all), this console's schema
    // varies per challenge, so initDb can't be a true zero-dependency
    // mount-only callback — the lint rule's cascading-render concern
    // doesn't apply to a single, deliberate, mount-time status update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initDb();
  }, [initDb]);

  async function execute() {
    if (!dbRef.current || !code.trim()) return;
    setRunning(true);
    setRunError(null);
    setMessage(null);
    try {
      const results = await dbRef.current.exec(code);
      const last = results[results.length - 1];
      if (last && last.fields.length > 0) {
        setResult(last as QueryResult);
      } else {
        setResult(null);
        setMessage("OK — no rows returned.");
      }
    } catch (err) {
      setResult(null);
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  // Remounting (via ChallengeConsole's key bump) gives this a fresh dbRef,
  // status, code, and result state automatically — nothing to clear here.
  const handleReset = onReset;

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-surface overflow-hidden"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          execute();
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "ready" ? "bg-success" : status === "error" ? "bg-error" : "bg-warning animate-pulse"
            }`}
          />
          <span className="text-foreground-secondary">
            {status === "loading" && "Starting sandbox…"}
            {status === "ready" && "Sandbox ready (in-browser, isolated to this tab)"}
            {status === "error" && "Failed to start sandbox"}
          </span>
        </div>
        <button
          onClick={handleReset}
          disabled={status === "loading"}
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors disabled:opacity-40 cursor-pointer"
          title="Reset the sandbox back to its seed data"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="border-b border-border">
        <CodeMirror
          value={code}
          onChange={setCode}
          height="220px"
          theme="dark"
          extensions={[sql({ dialect: PostgreSQL })]}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
        <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
          <span className="text-xs text-muted font-mono">⌘/Ctrl + Enter to run</span>
          <div className="flex items-center gap-2">
            <button
              onClick={execute}
              disabled={status !== "ready" || running}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface transition-colors disabled:opacity-40 cursor-pointer"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </button>
            <button
              onClick={() => onSubmit(code)}
              disabled={!code.trim() || submitting}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 text-sm">
        {initError && <p className="text-error font-mono text-xs whitespace-pre-wrap">{initError}</p>}
        {runError && <p className="text-error font-mono text-xs whitespace-pre-wrap">{runError}</p>}
        {message && !runError && <p className="text-foreground-secondary">{message}</p>}
        {result && !runError && (
          <div className="overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {result.fields.map((f) => (
                    <th
                      key={f.name}
                      className="sticky top-0 border-b border-border bg-surface-raised px-2 py-1.5 text-left font-mono font-medium whitespace-nowrap"
                    >
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="odd:bg-surface-raised/60">
                    {result.fields.map((f) => (
                      <td key={f.name} className="border-b border-border px-2 py-1.5 whitespace-nowrap font-mono">
                        {formatCell(row[f.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.rows.length === 0 && <p className="text-muted py-2">Query returned 0 rows.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
