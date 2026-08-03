"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, PenLine, Loader2 } from "lucide-react";
import { slugify } from "@/lib/slugify";
import type { GeneratedDraft } from "@/lib/generate-training";

type SandboxType = "sql" | "yaml";
type Level = "setup" | "foundations" | "intermediate" | "mastery" | "reference";

const LEVELS: Level[] = ["setup", "foundations", "intermediate", "mastery", "reference"];

type ReviewState = GeneratedDraft & { courseSlug: string; moduleSlug: string };

// level here is a placeholder — handleWriteManually always overrides it with
// whatever the level select was set to on the topic form, same as the AI path.
const BLANK_DRAFT: ReviewState = {
  courseTitle: "",
  courseDescription: "",
  courseTagline: "",
  courseSlug: "",
  moduleTitle: "",
  moduleDescription: "",
  moduleSlug: "",
  level: "intermediate",
  duration: "",
  content: "",
};

export function CreateTrainingForm() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [sandboxType, setSandboxType] = useState<SandboxType>("sql");
  const [level, setLevel] = useState<Level>("intermediate");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewState | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sandboxType, level }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Generation failed");
        return;
      }
      const d: GeneratedDraft = body.draft;
      setDraft({
        ...d,
        courseSlug: slugify(d.courseTitle),
        moduleSlug: slugify(d.moduleTitle),
      });
    } catch {
      setError("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleWriteManually() {
    setError(null);
    setDraft({ ...BLANK_DRAFT, level });
  }

  function updateDraft<K extends keyof ReviewState>(key: K, value: ReviewState[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  // Keep the slug in sync with the title until the slug is edited by hand —
  // otherwise a manually-written draft has two required-but-unmarked slug
  // fields that silently 400 on publish if left blank.
  function updateTitleAndSlug(
    titleKey: "courseTitle" | "moduleTitle",
    slugKey: "courseSlug" | "moduleSlug",
    value: string,
  ) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [titleKey]: value };
      if (!d[slugKey]) next[slugKey] = slugify(value);
      return next;
    });
  }

  async function handlePublish() {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generated-courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, sandboxType }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Publish failed");
        setPublishing(false);
        return;
      }
      router.push(`/courses/${draft.courseSlug}/${draft.moduleSlug}`);
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
            What should this training cover?
          </label>
          <textarea
            id="topic"
            required
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Recursive CTEs for hierarchical data, with a manager/employee org-chart example"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" htmlFor="sandboxType">
              Practice console
            </label>
            <select
              id="sandboxType"
              value={sandboxType}
              onChange={(e) => setSandboxType(e.target.value as SandboxType)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="sql">SQL (Postgres)</option>
              <option value="yaml">YAML (Kubernetes manifests)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1" htmlFor="level">
              Level
            </label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
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
        <p className="eyebrow">New course</p>
        <Field
          label="Title"
          value={draft.courseTitle}
          onChange={(v) => updateTitleAndSlug("courseTitle", "courseSlug", v)}
        />
        <Field
          label="URL slug"
          value={draft.courseSlug}
          onChange={(v) => updateDraft("courseSlug", slugify(v))}
          mono
        />
        <Field
          label="Tagline"
          value={draft.courseTagline}
          onChange={(v) => updateDraft("courseTagline", v)}
        />
        <Field
          label="Description"
          value={draft.courseDescription}
          onChange={(v) => updateDraft("courseDescription", v)}
          textarea
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
        <p className="eyebrow">Module</p>
        <Field
          label="Title"
          value={draft.moduleTitle}
          onChange={(v) => updateTitleAndSlug("moduleTitle", "moduleSlug", v)}
        />
        <Field
          label="URL slug"
          value={draft.moduleSlug}
          onChange={(v) => updateDraft("moduleSlug", slugify(v))}
          mono
        />
        <Field
          label="Description"
          value={draft.moduleDescription}
          onChange={(v) => updateDraft("moduleDescription", v)}
        />
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Level</label>
            <select
              value={draft.level}
              onChange={(e) => updateDraft("level", e.target.value as Level)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Field label="Duration" value={draft.duration} onChange={(v) => updateDraft("duration", v)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Content (Markdown/MDX)</label>
          <textarea
            value={draft.content}
            onChange={(e) => updateDraft("content", e.target.value)}
            rows={24}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-muted mt-1">
            Review this before publishing — nothing here is live yet. Publishing will take you to
            the real rendered page.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  textarea?: boolean;
}) {
  const className = `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent ${mono ? "font-mono" : ""}`;
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={className} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </div>
  );
}
