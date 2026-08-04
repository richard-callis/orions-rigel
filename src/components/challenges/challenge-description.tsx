import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

// Challenge descriptions are always DB-stored (AI-drafted or hand-written by
// an instructor), never file-based/committed content — so, same reasoning
// as Lesson's `trusted` prop, JS expressions are always blocked here. There
// is no trusted variant.
export function ChallengeDescription({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <MDXRemote source={content} options={{ mdxOptions: { remarkPlugins: [remarkGfm] }, blockJS: true }} />
    </div>
  );
}
