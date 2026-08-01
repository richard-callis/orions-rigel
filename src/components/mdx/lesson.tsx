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
}: {
  content: string;
  /** Override the default prose classes — e.g. larger sizing for Present mode. */
  proseClassName?: string;
  /** Lets MDX components (e.g. <Quiz>) look up which course/module they're rendering in. */
  courseSlug: string;
  moduleSlug: string;
}) {
  return (
    <LessonMetaProvider courseSlug={courseSlug} moduleSlug={moduleSlug}>
      <div className={proseClassName}>
        <MDXRemote
          source={content}
          components={mdxComponents}
          // next-mdx-remote strips {} JS expressions by default (blockJS) since
          // MDX content is often untrusted user input. Ours isn't — lesson
          // content lives in src/content/**, authored and committed by us, the
          // same trust level as any other source file — and <Quiz> needs
          // expression props (options={[...]}, answer={n}) to work at all.
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] }, blockJS: false }}
        />
      </div>
    </LessonMetaProvider>
  );
}
