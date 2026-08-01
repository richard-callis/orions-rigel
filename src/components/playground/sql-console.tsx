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
import { useSession } from "next-auth/react";
import { RotateCcw, Play, Loader2, Save, BookmarkIcon, Trash2, X } from "lucide-react";
import type { PGlite } from "@electric-sql/pglite";

type QueryResult = {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  affectedRows?: number;
};

type SavedQuery = {
  id: string;
  title: string;
  sql: string;
  createdAt: string;
};

export type SqlConsoleHandle = {
  runQuery: (sqlText: string) => void;
};

const DEFAULT_QUERY = `SELECT first_name, last_name, email\nFROM customers\nORDER BY signup_date\nLIMIT 5;`;

export const SqlConsole = forwardRef<SqlConsoleHandle, { courseSlug: string }>(
  function SqlConsole({ courseSlug }, ref) {
    const { status: authStatus } = useSession();
    const signedIn = authStatus === "authenticated";

    const dbRef = useRef<PGlite | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [initError, setInitError] = useState<string | null>(null);

    const [code, setCode] = useState(DEFAULT_QUERY);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [runError, setRunError] = useState<string | null>(null);

    const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
    const [showSaved, setShowSaved] = useState(false);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [saving, setSaving] = useState(false);

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

    const loadSavedQueries = useCallback(async () => {
      const res = await fetch(`/api/saved-queries?courseSlug=${encodeURIComponent(courseSlug)}`);
      if (res.ok) {
        const body = await res.json();
        setSavedQueries(body.queries);
      }
    }, [courseSlug]);

    useEffect(() => {
      if (signedIn) loadSavedQueries();
    }, [signedIn, loadSavedQueries]);

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

    async function handleSaveConfirm() {
      if (!saveTitle.trim() || !code.trim()) return;
      setSaving(true);
      try {
        const res = await fetch("/api/saved-queries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseSlug, title: saveTitle.trim(), sql: code }),
        });
        if (res.ok) {
          const body = await res.json();
          setSavedQueries((qs) => [body.query, ...qs]);
          setShowSaveForm(false);
          setSaveTitle("");
        }
      } finally {
        setSaving(false);
      }
    }

    async function handleDelete(id: string) {
      setSavedQueries((qs) => qs.filter((q) => q.id !== id));
      await fetch(`/api/saved-queries/${id}`, { method: "DELETE" });
    }

    function handleLoad(query: SavedQuery) {
      setCode(query.sql);
      setShowSaved(false);
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
          <div className="flex items-center gap-2">
            {signedIn && (
              <div className="relative">
                <button
                  onClick={() => setShowSaved((v) => !v)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors cursor-pointer"
                  title="Saved queries"
                >
                  <BookmarkIcon size={12} /> Saved{savedQueries.length > 0 && ` (${savedQueries.length})`}
                </button>
                {showSaved && (
                  <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-border bg-surface-raised shadow-lg">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="eyebrow">Saved queries</span>
                      <button
                        onClick={() => setShowSaved(false)}
                        className="text-muted hover:text-foreground cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {savedQueries.length === 0 && (
                        <p className="px-3 py-3 text-xs text-muted">
                          Nothing saved yet — write a query and hit Save.
                        </p>
                      )}
                      {savedQueries.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface"
                        >
                          <button
                            onClick={() => handleLoad(q)}
                            className="min-w-0 flex-1 truncate text-left text-xs cursor-pointer"
                            title={q.sql}
                          >
                            {q.title}
                          </button>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="text-muted hover:text-error shrink-0 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleReset}
              disabled={status === "loading"}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors disabled:opacity-40 cursor-pointer"
              title="Reset the practice database back to its seed data"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
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
          {showSaveForm && (
            <div className="flex items-center gap-2 border-t border-border bg-surface-raised px-3 py-2">
              <input
                autoFocus
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveConfirm();
                  if (e.key === "Escape") setShowSaveForm(false);
                }}
                placeholder="Name this query…"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                onClick={handleSaveConfirm}
                disabled={saving || !saveTitle.trim()}
                className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
            <span className="text-xs text-muted font-mono">⌘/Ctrl + Enter to run</span>
            <div className="flex items-center gap-2">
              {signedIn && !showSaveForm && (
                <button
                  onClick={() => setShowSaveForm(true)}
                  disabled={!code.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface transition-colors disabled:opacity-40 cursor-pointer"
                  title="Save this query"
                >
                  <Save size={12} /> Save
                </button>
              )}
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
  }
);

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
