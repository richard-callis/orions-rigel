import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "./mdx-components";

const DEFAULT_PROSE = "prose prose-invert max-w-none prose-headings:scroll-mt-20";

export function Lesson({
  content,
  proseClassName = DEFAULT_PROSE,
}: {
  content: string;
  /** Override the default prose classes — e.g. larger sizing for Present mode. */
  proseClassName?: string;
}) {
  return (
    <div className={proseClassName}>
      <MDXRemote
        source={content}
        components={mdxComponents}
        options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
      />
    </div>
  );
}
