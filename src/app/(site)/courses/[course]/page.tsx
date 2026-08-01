import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { getCourse, getCourseModules } from "@/lib/content";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ course: string }> };

export async function generateMetadata({ params }: Props) {
  const { course: courseSlug } = await params;
  const course = getCourse(courseSlug);
  return { title: course ? `${course.title} · Technical Training` : "Not found" };
}

const LEVEL_LABEL: Record<string, string> = {
  setup: "Setup",
  foundations: "Foundations",
  intermediate: "Intermediate",
  mastery: "Mastery",
  reference: "Reference",
};

export default async function CourseOverviewPage({ params }: Props) {
  const { course: courseSlug } = await params;

  const course = getCourse(courseSlug);
  const modules = getCourseModules(courseSlug);
  if (!course) notFound();

  const session = await auth();
  let completedSlugs = new Set<string>();
  if (session?.user) {
    const rows = await db.lessonProgress.findMany({
      where: { userId: session.user.id, courseSlug },
      select: { moduleSlug: true },
    });
    completedSlugs = new Set(rows.map((r) => r.moduleSlug));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">{course.title}</h1>
      {course.tagline && <p className="text-accent mb-3">{course.tagline}</p>}
      <p className="text-foreground/60 mb-8">{course.description}</p>

      {session?.user && (
        <p className="text-sm text-foreground/50 mb-4">
          {completedSlugs.size} / {modules.length} modules complete
        </p>
      )}

      <ol className="space-y-2">
        {modules.map((mod) => {
          const done = completedSlugs.has(mod.slug);
          return (
            <li key={mod.slug}>
              <Link
                href={`/courses/${courseSlug}/${mod.slug}`}
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:border-accent transition-colors"
              >
                {done ? (
                  <Check size={18} className="text-green-600 shrink-0" />
                ) : (
                  <Circle size={18} className="text-foreground/20 shrink-0" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mod.title}</span>
                    <span className="text-xs text-foreground/40">
                      {LEVEL_LABEL[mod.level] ?? mod.level}
                    </span>
                  </div>
                  {mod.description && (
                    <p className="text-sm text-foreground/60">{mod.description}</p>
                  )}
                </div>
                {mod.duration && (
                  <span className="text-xs text-foreground/40 shrink-0">{mod.duration}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
