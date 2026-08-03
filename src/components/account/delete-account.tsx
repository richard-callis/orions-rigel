"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function DeleteAccount() {
  const [deleteData, setDeleteData] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmText === "DELETE" && !pending;

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteData, confirm: confirmText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't delete your account. Try again.");
        setPending(false);
        return;
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Couldn't delete your account. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-error/30 bg-error/5 p-5">
      <p className="eyebrow mb-2 flex items-center gap-1.5 !text-error">
        <AlertTriangle size={12} /> Danger zone
      </p>
      <h2 className="text-lg font-semibold mb-1">Delete your account</h2>
      <p className="text-sm text-foreground-secondary mb-4">
        This removes your login and profile. By default your saved queries, lesson
        progress, and quiz answers stay attached to the (now anonymous) account —
        check the box below if you&apos;d rather those were permanently deleted too.
      </p>

      <label className="flex items-start gap-2 text-sm mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={deleteData}
          onChange={(e) => setDeleteData(e.target.checked)}
          className="mt-0.5"
        />
        Also permanently delete my saved queries, progress, and quiz answers
      </label>

      <label className="block text-sm mb-1" htmlFor="confirm-delete">
        Type <span className="font-mono font-semibold">DELETE</span> to confirm
      </label>
      <input
        id="confirm-delete"
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-error mb-4"
        placeholder="DELETE"
        autoComplete="off"
      />

      {error && <p className="text-sm text-error mb-4">{error}</p>}

      <button
        onClick={handleDelete}
        disabled={!canSubmit}
        className="flex items-center gap-1.5 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {deleteData ? "Delete account and all my data" : "Delete my account"}
      </button>
    </div>
  );
}
