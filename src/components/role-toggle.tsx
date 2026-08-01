"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { GraduationCap, Loader2 } from "lucide-react";

export function RoleToggle() {
  const { data: session, update } = useSession();
  const [pending, setPending] = useState(false);

  if (!session?.user) return null;
  const isInstructor = session.user.role === "INSTRUCTOR";

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch("/api/account/role", { method: "POST" });
      if (res.ok) {
        const body = await res.json();
        await update({ role: body.role });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-raised transition-colors cursor-pointer disabled:opacity-50"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <GraduationCap size={12} />}
      {isInstructor ? "Switch to student view" : "Switch to instructor view"}
    </button>
  );
}
