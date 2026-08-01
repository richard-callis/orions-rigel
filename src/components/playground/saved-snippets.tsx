"use client";

import { useState } from "react";
import { BookmarkIcon, Save, Trash2, X } from "lucide-react";

export type SavedSnippet = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export function SavedSnippetsButton({
  items,
  onLoad,
  onDelete,
}: {
  items: SavedSnippet[];
  onLoad: (item: SavedSnippet) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-raised transition-colors cursor-pointer"
        title="Saved queries"
      >
        <BookmarkIcon size={12} /> Saved{items.length > 0 && ` (${items.length})`}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-border bg-surface-raised shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="eyebrow">Saved queries</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted">
                Nothing saved yet — write something and hit Save.
              </p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface"
              >
                <button
                  onClick={() => {
                    onLoad(item);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-xs cursor-pointer"
                  title={item.content}
                >
                  {item.title}
                </button>
                <button
                  onClick={() => onDelete(item.id)}
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
  );
}

export function SaveSnippetButton({
  disabled,
  onSave,
}: {
  disabled?: boolean;
  onSave: (title: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title.trim());
      setOpen(false);
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  if (open) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Name this query…"
          className="w-36 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          onClick={confirm}
          disabled={saving || !title.trim()}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
        >
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground cursor-pointer">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface transition-colors disabled:opacity-40 cursor-pointer"
      title="Save this"
    >
      <Save size={12} /> Save
    </button>
  );
}
