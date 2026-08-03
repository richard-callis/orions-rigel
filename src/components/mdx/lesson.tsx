import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "./mdx-components";
import { LessonMetaProvider } from "@/lib/lesson-meta-context";

const DEFAULT_PROSE = "prose prose-invert max-w-none prose-headings:scroll-mt-20";

export function Lesson({
  content,
  proseClassName = DEFAULT_PROSE,
  courseSlug,
  moduleSlug,
  trusted = false,
}: {
  content: string;
  /** Override the default prose classes — e.g. larger sizing for Present mode. */
  proseClassName?: string;
  /** Lets MDX components (e.g. <Quiz>) look up which course/module they're rendering in. */
  courseSlug: string;
  moduleSlug: string;
  /**
   * Pass true only for content authored and committed by us (src/content/**),
   * which needs {} JS expressions for <Quiz> props like options={[...]}.
   * Anything else — in particular instructor-generated content stored in
   * the DB — must render with JS expressions blocked (the next-mdx-remote
   * default): without this, `{process.env.AUTH_SECRET}` in a lesson body
   * would execute server-side and leak secrets to anyone who views it.
   */
  trusted?: boolean;
}) {
  return (
    <LessonMetaProvider courseSlug={courseSlug} moduleSlug={moduleSlug}>
      <div className={proseClassName}>
        <MDXRemote
          source={content}
          components={mdxComponents}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] }, blockJS: !trusted }}
        />
      </div>
    </LessonMetaProvider>
  );
}
