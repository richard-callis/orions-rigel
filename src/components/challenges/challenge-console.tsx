"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { Play, Send, RotateCcw, Loader2, Maximize2, Minimize2 } from "lucide-react";
import type { PGlite } from "@electric-sql/pglite";
import { useSavedSnippets } from "@/lib/use-saved-snippets";
import { SavedSnippetsButton, SaveSnippetButton } from "@/components/playground/saved-snippets";

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
export function ChallengeConsole({
  challengeSlug,
  schemaSql,
  initialSql,
  onSubmit,
  submitting,
}: {
  challengeSlug: string;
  schemaSql: string;
  initialSql?: string;
  onSubmit: (sql: string) => void;
  submitting: boolean;
}) {
  // Reuses the course-console saved-snippets API/model with a namespaced
  // scope key — a challenge slug never collides with a course slug, and a
  // dedicated table for one more (userId, scope) -> snippet mapping isn't
  // worth it.
  const { signedIn, items: savedQueries, save, remove } = useSavedSnippets(`challenge:${challengeSlug}`);
  const dbRef = useRef<PGlite | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [initError, setInitError] = useState<string | null>(null);

  const [code, setCode] = useState(initialSql ?? "");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  // Bumped by the Reset button to force initDb to re-run even though
  // schemaSql itself hasn't changed — schemaSql alone can't be the only
  // effect dependency, since it never varies on its own for a mounted
  // console (one console per active challenge).
  const [resetGeneration, setResetGeneration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Editor pane height in px; the results pane below it stays flex-1 and
  // just absorbs whatever's left, so only one dimension needs tracking.
  const [editorHeight, setEditorHeight] = useState(220);
  const draggingRef = useRef(false);

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onResize(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setEditorHeight((h) => Math.min(Math.max(h + e.movementY, 100), 900));
  }
  function stopResize() {
    draggingRef.current = false;
  }

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
    // Setting "loading" synchronously here is the point, not a bug to
    // route around: the sandbox genuinely isn't ready and the UI needs to
    // say so before the async PGlite import resolves. This project's
    // set-state-in-effect rule doesn't flag the identical pattern in
    // SqlConsole — not because that component's schema is static (it
    // isn't a meaningful difference to this rule) but because SqlConsole
    // is declared via forwardRef, which this rule doesn't analyze. That's
    // a blind spot in the rule, not a real distinction; this effect is
    // exactly as safe as SqlConsole's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initDb();
  }, [initDb, resetGeneration]);

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

  function handleReset() {
    dbRef.current = null;
    setResult(null);
    setMessage(null);
    setRunError(null);
    setResetGeneration((g) => g + 1);
  }

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col rounded-none border border-border bg-surface"
          : "flex h-full flex-col rounded-xl border border-border bg-surface overflow-hidden"
      }
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
        <div className="flex items-center gap-2">
          {signedIn && (
            <SavedSnippetsButton items={savedQueries} onLoad={(item) => setCode(item.content)} onDelete={remove} />
          )}
          <button
            onClick={handleReset}
            disabled={status === "loading"}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors disabled:opacity-40 cursor-pointer"
            title="Reset the sandbox back to its seed data"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors cursor-pointer"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      <div className="overflow-hidden border-b border-border" style={{ height: editorHeight }}>
        <CodeMirror
          value={code}
          onChange={setCode}
          height="100%"
          className="h-full"
          theme="dark"
          extensions={[sql({ dialect: PostgreSQL })]}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
      </div>
      <div
        onPointerDown={startResize}
        onPointerMove={onResize}
        onPointerUp={stopResize}
        className="h-1.5 shrink-0 cursor-row-resize bg-border hover:bg-accent/50 transition-colors"
        title="Drag to resize"
      />
      <div className="flex items-center justify-between border-b border-border bg-surface-raised px-3 py-2">
        <span className="text-xs text-muted font-mono">⌘/Ctrl + Enter to run</span>
        <div className="flex items-center gap-2">
          {signedIn && <SaveSnippetButton disabled={!code.trim()} onSave={(title) => save(title, code)} />}
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

      <div className="flex-1 min-h-0 overflow-auto p-3 text-sm">
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
