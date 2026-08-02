import type { ReactNode } from "react";

export function Callout({ label, children }: { label?: string; children?: ReactNode }) {
  return (
    <div className="not-prose my-6 rounded-xl border border-border bg-surface p-5">
      {label && <p className="eyebrow mb-2 !text-accent">{label}</p>}
      <div className="text-sm leading-relaxed text-foreground [&_p]:mb-2 [&_p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
