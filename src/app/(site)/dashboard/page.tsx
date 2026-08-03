import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourses, getCourseModules } from "@/lib/content";
import { RoleToggle } from "@/components/role-toggle";

export const metadata = { title: "Dashboard · Technical Training" };

export default async function DashboardPage() {
  const session = await auth();
  // proxy.ts already gates this route, but keep the page safe if hit directly in dev.
  if (!session?.user) return null;

  const courses = getCourses();
  const progress = await db.lessonProgress.findMany({
    where: { userId: session.user.id },
    select: { courseSlug: true, moduleSlug: true },
  });

  const completedByCourse = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!completedByCourse.has(p.courseSlug)) completedByCourse.set(p.courseSlug, new Set());
    completedByCourse.get(p.courseSlug)!.add(p.moduleSlug);
  }

  // Count pending reviews
  const now = new Date();
  const pendingReviewCount = await db.reviewSchedule.count({
    where: {
      userId: session.user.id,
      dueAt: { lte: now },
    },
  });

  return (
    <div className="w-full mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Welcome back, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-foreground-secondary">Here&apos;s where you left off.</p>
          {pendingReviewCount > 0 && (
            <p className="text-sm text-accent font-medium mt-2">
              <a href="/review" className="hover:underline">
                {pendingReviewCount} module{pendingReviewCount === 1 ? "" : "s"} due for review
              </a>
            </p>
          )}
        </div>
        <RoleToggle />
      </div>

      <div className="space-y-4">
        {courses.map((course) => {
          const modules = getCourseModules(course.slug);
          const completed = completedByCourse.get(course.slug) ?? new Set();
          const nextModule = modules.find((m) => !completed.has(m.slug)) ?? modules[0];
          const pct = modules.length > 0 ? Math.round((completed.size / modules.length) * 100) : 0;

          return (
            <div key={course.slug} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/courses/${course.slug}`} className="font-semibold hover:text-accent transition-colors">
                  {course.title}
                </Link>
                <span className="text-sm text-muted font-mono">
                  {completed.size} / {modules.length} complete
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-border mb-4 overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>

              {nextModule && (
                <Link
                  href={`/courses/${course.slug}/${nextModule.slug}`}
                  className="inline-block rounded-lg bg-accent text-accent-foreground text-sm px-3 py-1.5 font-medium hover:opacity-90 transition-opacity"
                >
                  {completed.size === 0 ? "Start" : "Continue"}: {nextModule.title}
                </Link>
              )}
            </div>
          );
        })}

        {courses.length === 0 && (
          <p className="text-muted">No courses published yet.</p>
        )}
      </div>
    </div>
  );
}
