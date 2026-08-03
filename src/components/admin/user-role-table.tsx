"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Trash2 } from "lucide-react";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
  createdAt: string;
};

const ROLES: AdminUser["role"][] = ["STUDENT", "INSTRUCTOR", "ADMIN"];

export function UserRoleTable({ initialUsers }: { initialUsers: AdminUser[] }) {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const [users, setUsers] = useState(initialUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function changeRole(id: string, role: AdminUser["role"]) {
    setPendingId(id);
    setError(null);
    const previous = users;
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, role } : u)));

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUsers(previous);
        setError(body.error ?? "Couldn't update that role.");
      }
    } finally {
      setPendingId(null);
    }
  }

  async function deleteUser(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Couldn't delete that user.");
        return;
      }
      setUsers((us) => us.filter((u) => u.id !== id));
      setConfirmingId(null);
      setConfirmText("");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {error && (
        <p className="border-b border-border bg-error/10 px-4 py-2 text-sm text-error">{error}</p>
      )}
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-raised">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Name</th>
            <th className="px-4 py-2 text-left font-medium">Email</th>
            <th className="px-4 py-2 text-left font-medium">Role</th>
            <th className="px-4 py-2 text-left font-medium sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="px-4 py-2.5">
                {u.name}
                {u.id === myId && <span className="ml-1.5 text-xs text-muted">(you)</span>}
              </td>
              <td className="px-4 py-2.5 text-foreground-secondary">{u.email}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    disabled={pendingId === u.id}
                    onChange={(e) => changeRole(u.id, e.target.value as AdminUser["role"])}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {pendingId === u.id && <Loader2 size={14} className="animate-spin text-muted" />}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right">
                {u.id === myId ? null : confirmingId === u.id ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                      autoFocus
                      className="w-24 rounded-lg border border-error/40 bg-surface px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-error"
                    />
                    <button
                      onClick={() => deleteUser(u.id)}
                      disabled={confirmText !== "DELETE" || deletingId === u.id}
                      className="rounded-lg bg-error px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        setConfirmingId(null);
                        setConfirmText("");
                      }}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-surface-raised transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmingId(u.id);
                      setConfirmText("");
                      setError(null);
                    }}
                    title="Delete user and all their data"
                    className="rounded-lg p-1.5 text-muted hover:bg-error/10 hover:text-error transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
