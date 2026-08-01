import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Presentation } from "lucide-react";
import { getCourse, getModule, getModuleNeighbors } from "@/lib/content";
import { Lesson } from "@/components/mdx/lesson";
import { LearnLayout } from "@/components/playground/learn-layout";
import { MarkComplete } from "@/components/mark-complete";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = {
  params: Promise<{ course: string; module: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;
  const mod = getModule(courseSlug, moduleSlug);
  return { title: mod ? `${mod.meta.title} · Technical Training` : "Not found" };
}

const LEVEL_LABEL: Record<string, string> = {
  setup: "Setup",
  foundations: "Foundations",
  intermediate: "Intermediate",
  mastery: "Mastery",
  reference: "Reference",
};

export default async function ModulePage({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;

  const course = getCourse(courseSlug);
  const mod = getModule(courseSlug, moduleSlug);
  if (!course || !mod) notFound();

  const { prev, next } = getModuleNeighbors(courseSlug, moduleSlug);

  const session = await auth();
  let initiallyCompleted = false;
  if (session?.user) {
    const progress = await db.lessonProgress.findUnique({
      where: {
        userId_courseSlug_moduleSlug: {
          userId: session.user.id,
          courseSlug,
          moduleSlug,
        },
      },
    });
    initiallyCompleted = Boolean(progress);
  }

  return (
    <LearnLayout>
      <div className="mb-6 flex items-center justify-between text-sm">
        <Link
          href={`/courses/${courseSlug}`}
          className="flex items-center gap-1 text-foreground-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft size={14} /> {course.title}
        </Link>
        <Link
          href={`/present/${courseSlug}/${moduleSlug}`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 hover:bg-surface-raised transition-colors"
        >
          <Presentation size={14} /> Present
        </Link>
      </div>

      <div className="mb-6">
        <p className="eyebrow mb-3">{LEVEL_LABEL[mod.meta.level] ?? mod.meta.level}</p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">{mod.meta.title}</h1>
        {mod.meta.description && (
          <p className="text-foreground-secondary mb-4">{mod.meta.description}</p>
        )}
        <div className="flex items-center gap-4">
          {mod.meta.duration && (
            <span className="text-sm text-muted font-mono">{mod.meta.duration}</span>
          )}
          <MarkComplete
            courseSlug={courseSlug}
            moduleSlug={moduleSlug}
            initiallyCompleted={initiallyCompleted}
          />
        </div>
      </div>

      <Lesson content={mod.content} />

      <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-sm">
        {prev ? (
          <Link
            href={`/courses/${courseSlug}/${prev.slug}`}
            className="flex items-center gap-1 text-foreground-secondary hover:text-accent transition-colors"
          >
            <ArrowLeft size={14} /> {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/courses/${courseSlug}/${next.slug}`}
            className="flex items-center gap-1 text-foreground-secondary hover:text-accent transition-colors"
          >
            {next.title} <ArrowRight size={14} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </LearnLayout>
  );
}
