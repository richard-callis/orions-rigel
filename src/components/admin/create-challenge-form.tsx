"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, PenLine, Loader2 } from "lucide-react";
import { slugify } from "@/lib/slugify";
import type { GeneratedChallengeDraft } from "@/lib/generate-challenge";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

type ReviewState = GeneratedChallengeDraft & { slug: string; weekOf: string; activate: boolean };

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

const BLANK_DRAFT: ReviewState = {
  title: "",
  slug: "",
  description: "",
  difficulty: "medium",
  schemaSql: "",
  hiddenSchemaSql: "",
  solutionSql: "",
  checkQuery: "",
  requireOrder: false,
  weekOf: nextMonday(),
  activate: false,
};

export function CreateChallengeForm() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewState | null>(null);
  // See PR #15's review history — a naive "if slug is empty" guard breaks
  // after the first keystroke. Only the slug field's own edit sets this.
  const [slugTouched, setSlugTouched] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/challenges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, difficulty }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Generation failed");
        return;
      }
      const d: GeneratedChallengeDraft = body.draft;
      setSlugTouched(false);
      setDraft({ ...BLANK_DRAFT, ...d, slug: slugify(d.title) });
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleWriteManually() {
    setError(null);
    setSlugTouched(false);
    setDraft({ ...BLANK_DRAFT, difficulty });
  }

  function updateDraft<K extends keyof ReviewState>(key: K, value: ReviewState[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function updateTitle(value: string) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, title: value };
      if (!slugTouched) next.slug = slugify(value);
      return next;
    });
  }

  async function handlePublish() {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Publish failed");
        setPublishing(false);
        return;
      }
      router.push("/admin/challenges");
    } catch {
      setError("Publish failed. Try again.");
      setPublishing(false);
    }
  }

  if (!draft) {
    return (
      <form onSubmit={handleGenerate} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="topic">
            What should this challenge be about?
          </label>
          <textarea
            id="topic"
            required
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Deduplicate near-duplicate customer records by fuzzy-matching name + email"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="difficulty">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? "Generating…" : "Generate draft"}
          </button>
          <span className="text-xs text-muted">or</span>
          <button
            type="button"
            onClick={handleWriteManually}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-raised transition-colors cursor-pointer"
          >
            <PenLine size={14} />
            Write it myself
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <p className="eyebrow">Challenge</p>
        <Field label="Title" value={draft.title} onChange={updateTitle} />
        <Field
          label="URL slug"
          value={draft.slug}
          onChange={(v) => {
            setSlugTouched(true);
            updateDraft("slug", slugify(v));
          }}
          mono
        />
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Difficulty</label>
            <select
              value={draft.difficulty}
              onChange={(e) => updateDraft("difficulty", e.target.value as Difficulty)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Week of</label>
            <input
              type="date"
              value={draft.weekOf}
              onChange={(e) => updateDraft("weekOf", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
        <Field
          label="Description (Markdown)"
          value={draft.description}
          onChange={(v) => updateDraft("description", v)}
          textarea
          rows={6}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <p className="eyebrow">Sandbox &amp; grading</p>
        <Field
          label="Schema SQL (DDL + example data students can see and explore in the practice console)"
          value={draft.schemaSql}
          onChange={(v) => updateDraft("schemaSql", v)}
          textarea
          mono
          rows={8}
        />
        <Field
          label="Hidden grading data (same table/column structure, different row values — students never see this; submissions are graded against it, not the schema above, so a solution that just hardcodes the visible example's answer can't pass)"
          value={draft.hiddenSchemaSql}
          onChange={(v) => updateDraft("hiddenSchemaSql", v)}
          textarea
          mono
          rows={8}
        />
        <Field
          label="Reference solution (a single SELECT — verified against Check query, on both datasets above, before publish)"
          value={draft.solutionSql}
          onChange={(v) => updateDraft("solutionSql", v)}
          textarea
          mono
          rows={4}
        />
        <Field
          label="Check query (defines the correct result set — usually identical to the solution)"
          value={draft.checkQuery}
          onChange={(v) => updateDraft("checkQuery", v)}
          textarea
          mono
          rows={4}
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.requireOrder}
            onChange={(e) => updateDraft("requireOrder", e.target.checked)}
          />
          Row order matters (otherwise results are compared as sets)
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer rounded-xl border border-border bg-surface p-4">
        <input
          type="checkbox"
          checked={draft.activate}
          onChange={(e) => updateDraft("activate", e.target.checked)}
        />
        Activate immediately — deactivates whatever challenge is currently live
      </label>

      {error && <p className="text-sm text-error whitespace-pre-wrap">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
        >
          {publishing ? "Publishing…" : "Publish"}
        </button>
        <button
          onClick={() => setDraft(null)}
          disabled={publishing}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-raised transition-colors cursor-pointer disabled:opacity-50"
        >
          Discard and start over
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  textarea?: boolean;
  rows?: number;
}) {
  const className = `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent ${mono ? "font-mono text-xs" : ""}`;
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows ?? 3} className={className} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </div>
  );
}
