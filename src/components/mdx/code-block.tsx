"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Play } from "lucide-react";
import { usePlayground } from "@/lib/playground-context";

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

export function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const playground = usePlayground();

  const language = className?.replace("language-", "") ?? "";
  const code = textOf(children).replace(/\n$/, "");

  const canRun = playground !== null && (language === "sql" || language === "");

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="not-prose group relative my-4 overflow-hidden rounded-lg border border-border bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-xs text-white/40 font-mono">{language || "code"}</span>
        <div className="flex items-center gap-1">
          {canRun && (
            <button
              onClick={() => playground!.runQuery(code)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Run in console"
            >
              <Play size={12} /> Run
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Copy code"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed">
        <code className="font-mono text-white/90">{code}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="rounded bg-black/[0.06] px-1 py-0.5 text-[0.85em] font-mono dark:bg-white/10">
      {children}
    </code>
  );
}
