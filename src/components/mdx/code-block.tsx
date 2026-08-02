"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Play, ShieldCheck } from "lucide-react";
import { usePlayground } from "@/lib/playground-context";
import { highlightCode } from "@/lib/highlight-code";

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

const TOKEN_CLASS: Record<string, string> = {
  keyword: "text-info font-semibold",
  string: "text-success",
  comment: "text-muted italic",
  number: "text-warning",
  plain: "text-foreground",
};

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

  const canRun =
    playground !== null &&
    (playground.kind === "yaml"
      ? language === "yaml" || language === "yml"
      : language === "sql" || language === "");
  const actionLabel = playground?.kind === "yaml" ? "Validate" : "Run";
  const ActionIcon = playground?.kind === "yaml" ? ShieldCheck : Play;

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tokens = highlightCode(code, language);

  return (
    <div className="not-prose group relative my-4 overflow-hidden rounded-xl border border-border bg-code-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <span className="eyebrow">{language || "code"}</span>
        </div>
        <div className="flex items-center gap-1">
          {canRun && (
            <button
              onClick={() => playground!.runQuery(code)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-foreground-secondary hover:bg-foreground/10 hover:text-foreground transition-colors cursor-pointer"
              title={`${actionLabel} in console`}
            >
              <ActionIcon size={12} /> {actionLabel}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-foreground-secondary hover:bg-foreground/10 hover:text-foreground transition-colors cursor-pointer"
            title="Copy code"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-sm leading-relaxed">
        <code className="font-mono">
          {tokens.map((token, i) => (
            <span key={i} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="rounded bg-surface-raised px-1 py-0.5 text-[0.85em] font-mono text-foreground">
      {children}
    </code>
  );
}
