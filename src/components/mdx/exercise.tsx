"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useLessonMeta } from "@/lib/lesson-meta-context";

type ExerciseType = "sql" | "yaml";

export function Exercise({
  id,
  prompt,
  type = "sql",
  sql,
  checks,
}: {
  id: string;
  prompt: string;
  type?: ExerciseType;
  sql?: string; // reference query for SQL exercises
  checks?: Array<{ path: string; equals: unknown }>; // assertions for YAML exercises
}) {
  const { courseSlug, moduleSlug } = useLessonMeta();
  const { data: authSession, status: authStatus } = useSession();
  const [status, setStatus] = useState<"idle" | "checking" | "passed" | "failed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exerciseKey = `${courseSlug}:${moduleSlug}:${id}`;

  // Check for persisted attempt on mount
  useEffect(() => {
    async function checkPersisted() {
      if (!authSession?.user) return;
      try {
        const res = await fetch(
          `/api/exercises/attempt?exerciseKey=${encodeURIComponent(exerciseKey)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.attempt?.passed) {
            setStatus("passed");
            setMessage("You've already completed this exercise!");
          }
        }
      } catch {
        // ignore silently
      }
    }
    checkPersisted();
  }, [authSession?.user, exerciseKey]);

  async function checkAnswer(studentCode: string) {
    if (!studentCode.trim()) {
      setError("Please write a query or manifest.");
      return;
    }

    setStatus("checking");
    setError(null);
    setMessage(null);

    try {
      if (type === "sql") {
        const result = await checkSqlAnswer(studentCode, sql!);
        if (result.passed) {
          setStatus("passed");
          setMessage("Correct!");
          if (authSession?.user) {
            await recordAttempt(true);
          }
        } else {
          setStatus("failed");
          setMessage(result.message);
        }
      } else if (type === "yaml") {
        const result = checkYamlAnswer(studentCode, checks!);
        if (result.passed) {
          setStatus("passed");
          setMessage("Correct!");
          if (authSession?.user) {
            await recordAttempt(true);
          }
        } else {
          setStatus("failed");
          setMessage(result.message);
        }
      }
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function checkSqlAnswer(
    studentQuery: string,
    referenceQuery: string
  ): Promise<{ passed: boolean; message: string }> {
    // Import PGlite dynamically
    const { PGlite } = await import("@electric-sql/pglite");

    // Create a fresh instance for grading
    const gradingDb = new PGlite();

    // Load schema
    const schemaSql = await fetch("/sql/schema.sql").then((r) => {
      if (!r.ok) throw new Error("Could not load schema");
      return r.text();
    });

    await gradingDb.exec(schemaSql);

    // Execute both queries
    let studentResult, referenceResult;
    try {
      const studentResults = await gradingDb.exec(studentQuery);
      studentResult = studentResults[studentResults.length - 1];
    } catch (err) {
      return {
        passed: false,
        message: `Your query has a syntax error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      const refResults = await gradingDb.exec(referenceQuery);
      referenceResult = refResults[refResults.length - 1];
    } catch (err) {
      return {
        passed: false,
        message: `Reference query failed (this is a problem with the exercise): ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Compare results: row count first
    const studentRows = studentResult?.rows ?? [];
    const referenceRows = referenceResult?.rows ?? [];

    if (studentRows.length !== referenceRows.length) {
      return {
        passed: false,
        message: `Expected ${referenceRows.length} row(s), got ${studentRows.length}.`,
      };
    }

    // If no rows, consider it a pass
    if (studentRows.length === 0) {
      return { passed: true, message: "" };
    }

    // Compare row contents (order-insensitive by sorting as stringified rows)
    const studentSorted = studentRows
      .map((r) => JSON.stringify(r, Object.keys(r).sort()))
      .sort();
    const referenceSorted = referenceRows
      .map((r) => JSON.stringify(r, Object.keys(r).sort()))
      .sort();

    for (let i = 0; i < studentSorted.length; i++) {
      if (studentSorted[i] !== referenceSorted[i]) {
        return {
          passed: false,
          message: `Row content mismatch. Your query returned different data than expected.`,
        };
      }
    }

    return { passed: true, message: "" };
  }

  function checkYamlAnswer(
    studentManifest: string,
    checks: Array<{ path: string; equals: unknown }>
  ): { passed: boolean; message: string } {
    try {
      // Parse YAML manually (simple key.value parsing for now)
      const doc = parseSimpleYaml(studentManifest);

      for (const check of checks) {
        const value = getNestedValue(doc, check.path);
        if (JSON.stringify(value) !== JSON.stringify(check.equals)) {
          return {
            passed: false,
            message: `Assertion failed: ${check.path} should equal ${JSON.stringify(check.equals)}, got ${JSON.stringify(value)}.`,
          };
        }
      }

      return { passed: true, message: "" };
    } catch (err) {
      return {
        passed: false,
        message: `YAML parse error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async function recordAttempt(passed: boolean) {
    try {
      await fetch("/api/exercises/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseKey, passed }),
      });
    } catch {
      // ignore silently
    }
  }

  return (
    <ExerciseContent
      prompt={prompt}
      type={type}
      status={status}
      message={message}
      error={error}
      onCheckAnswer={checkAnswer}
      isSignedIn={authStatus === "authenticated"}
    />
  );
}

function ExerciseContent({
  prompt,
  type,
  status,
  message,
  error,
  onCheckAnswer,
  isSignedIn,
}: {
  prompt: string;
  type: ExerciseType;
  status: string;
  message: string | null;
  error: string | null;
  onCheckAnswer: (code: string) => void;
  isSignedIn: boolean;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-5">
      <div className="mb-4">
        <p className="eyebrow mb-2 text-accent">Exercise</p>
        <p className="text-sm leading-relaxed">{prompt}</p>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface-raised p-3">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={type === "sql" ? "Write your SQL query here..." : "Write your YAML manifest here..."}
          className="w-full h-32 bg-transparent font-mono text-xs text-foreground placeholder-muted resize-none outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-xs text-error font-mono whitespace-pre-wrap">
          {error}
        </div>
      )}

      {status === "passed" && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-success">Correct!</p>
            {message && <p className="text-xs text-foreground-secondary mt-1">{message}</p>}
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 flex items-start gap-2">
          <XCircle size={16} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-error">Not quite right</p>
            {message && <p className="text-xs text-foreground-secondary mt-1">{message}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onCheckAnswer(code)}
          disabled={status === "checking" || !code.trim() || !isSignedIn}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
        >
          {status === "checking" ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Checking...
            </>
          ) : (
            "Check answer"
          )}
        </button>
        {!isSignedIn && (
          <p className="text-xs text-muted">Sign in to check answers.</p>
        )}
      </div>
    </div>
  );
}

type YamlValue = string | number | boolean | null | YamlObject;
type YamlObject = { [key: string]: YamlValue };

// Simple YAML parser for basic key.value.nested assertions
function parseSimpleYaml(yaml: string): YamlObject {
  const lines = yaml.split("\n");
  const result: YamlObject = {};
  const stack: Array<{ level: number; obj: YamlObject }> = [];
  let current = result;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2].trim();
    const value = match[3].trim();

    // Pop stack if indentation decreased
    while (stack.length > 0 && stack[stack.length - 1].level >= indent) {
      stack.pop();
    }

    // Determine current object to add to
    if (stack.length > 0) {
      current = stack[stack.length - 1].obj;
    } else {
      current = result;
    }

    // Parse value
    let parsedValue: YamlValue = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (value === "null") parsedValue = null;
    else if (!isNaN(Number(value))) parsedValue = Number(value);

    current[key] = parsedValue;
    const nested: YamlObject = {};
    stack.push({ level: indent, obj: nested });
    current[key] = nested;
  }

  return result;
}

function getNestedValue(obj: YamlValue, path: string): YamlValue | undefined {
  const keys = path.split(".");
  let current: YamlValue | undefined = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}
