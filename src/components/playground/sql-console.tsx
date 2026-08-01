"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { RotateCcw, Play, Loader2 } from "lucide-react";
import type { PGlite } from "@electric-sql/pglite";

type QueryResult = {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  affectedRows?: number;
};

export type SqlConsoleHandle = {
  runQuery: (sqlText: string) => void;
};

const DEFAULT_QUERY = `SELECT first_name, last_name, email\nFROM customers\nORDER BY signup_date\nLIMIT 5;`;

export const SqlConsole = forwardRef<SqlConsoleHandle>(function SqlConsole(_props, ref) {
  const dbRef = useRef<PGlite | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [initError, setInitError] = useState<string | null>(null);

  const [code, setCode] = useState(DEFAULT_QUERY);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const initDb = useCallback(async () => {
    setStatus("loading");
    setInitError(null);
    try {
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite();
      const schemaSql = await fetch("/sql/schema.sql").then((r) => {
        if (!r.ok) throw new Error(`Could not load schema.sql (${r.status})`);
        return r.text();
      });
      await db.exec(schemaSql);
      dbRef.current = db;
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setInitError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    initDb();
  }, [initDb]);

  const execute = useCallback(async (sqlText: string) => {
    if (!dbRef.current || !sqlText.trim()) return;
    setRunning(true);
    setRunError(null);
    setMessage(null);

    try {
      const results = await dbRef.current.exec(sqlText);
      const last = results[results.length - 1];

      if (last && last.fields.length > 0) {
        setResult(last as QueryResult);
      } else {
        setResult(null);
        setMessage(
          last?.affectedRows !== undefined
            ? `OK — ${last.affectedRows} row(s) affected.`
            : "OK."
        );
      }
    } catch (err) {
      setResult(null);
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      runQuery: (sqlText: string) => {
        setCode(sqlText);
        execute(sqlText);
      },
    }),
    [execute]
  );

  async function handleReset() {
    dbRef.current = null;
    setResult(null);
    setMessage(null);
    setRunError(null);
    await initDb();
  }

  return (
    <div
      className="flex h-full flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          execute(code);
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "ready"
                ? "bg-success"
                : status === "error"
                  ? "bg-error"
                  : "bg-warning animate-pulse"
            }`}
          />
          <span className="text-foreground-secondary">
            {status === "loading" && "Starting practice database…"}
            {status === "ready" && "Practice database ready (in-browser, isolated to this tab)"}
            {status === "error" && "Failed to start database"}
          </span>
        </div>
        <button
          onClick={handleReset}
          disabled={status === "loading"}
          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors disabled:opacity-40 cursor-pointer"
          title="Reset the practice database back to its seed data"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="border-b border-border">
        <CodeMirror
          value={code}
          onChange={setCode}
          height="180px"
          theme="dark"
          extensions={[sql({ dialect: PostgreSQL })]}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
        <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
          <span className="text-xs text-muted font-mono">⌘/Ctrl + Enter to run</span>
          <button
            onClick={() => execute(code)}
            disabled={status !== "ready" || running}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 text-sm">
        {initError && (
          <p className="text-error font-mono text-xs whitespace-pre-wrap">{initError}</p>
        )}
        {runError && (
          <p className="text-error font-mono text-xs whitespace-pre-wrap">{runError}</p>
        )}
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
            {result.rows.length === 0 && (
              <p className="text-muted py-2">Query returned 0 rows.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
