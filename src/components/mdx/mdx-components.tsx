import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import { CodeBlock, InlineCode } from "./code-block";
import { Quiz } from "./quiz";

export const mdxComponents: NonNullable<MDXRemoteProps["components"]> = {
  Quiz,
  // Fenced code blocks arrive as <pre><code className="language-xxx">...</code></pre>.
  // Un-wrap `pre` and let `code` render the full card — this keeps className/children
  // as plain, stable props instead of reaching into a nested element from `pre`.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) =>
    className?.startsWith("language-") ? (
      <CodeBlock className={className}>{children}</CodeBlock>
    ) : (
      <InlineCode>{children}</InlineCode>
    ),
  table: ({ children }) => (
    <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top">{children}</td>,
  details: ({ children }) => (
    <details className="not-prose my-4 rounded-lg border border-border p-3 open:pb-3 [&_pre]:mt-2">
      {children}
    </details>
  ),
  summary: ({ children }) => (
    <summary className="cursor-pointer select-none font-medium text-accent">{children}</summary>
  ),
};
