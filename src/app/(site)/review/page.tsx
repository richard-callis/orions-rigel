import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourses, getCourseModules } from "@/lib/content";
import { ReviewCard } from "@/components/review-card";

export const metadata = { title: "Review · Technical Training" };

export default async function ReviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  // Get all review schedules due for this user (dueAt <= now)
  const now = new Date();
  const dueReviews = await db.reviewSchedule.findMany({
    where: {
      userId: session.user.id,
      dueAt: { lte: now },
    },
    orderBy: { dueAt: "asc" },
  });

  // Get course and module metadata
  const courses = getCourses();
  const modulesByKey = new Map<string, { title: string; course: string }>();

  for (const course of courses) {
    const courseModules = getCourseModules(course.slug);
    for (const mod of courseModules) {
      modulesByKey.set(`${course.slug}:${mod.slug}`, {
        title: mod.title,
        course: course.title,
      });
    }
  }

  // Filter to only include modules that still exist in content
  const reviews = dueReviews
    .map((review) => ({
      ...review,
      metadata: modulesByKey.get(`${review.courseSlug}:${review.moduleSlug}`),
    }))
    .filter((r) => r.metadata);

  return (
    <div className="w-full mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Spaced Repetition Review</h1>
        <p className="text-foreground-secondary">
          {reviews.length === 0
            ? "No modules due for review right now. Keep learning!"
            : `You have ${reviews.length} module${reviews.length === 1 ? "" : "s"} due for review.`}
        </p>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <ReviewCard
            key={`${review.courseSlug}:${review.moduleSlug}`}
            review={review}
            moduleName={review.metadata!.title}
            courseName={review.metadata!.course}
          />
        ))}

        {reviews.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-muted mb-4">
              Once you complete modules, they&apos;ll appear here for spaced repetition review.
            </p>
            <Link
              href="/dashboard"
              className="inline-block rounded-lg bg-accent text-accent-foreground text-sm px-4 py-2 font-medium hover:opacity-90 transition-opacity"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
