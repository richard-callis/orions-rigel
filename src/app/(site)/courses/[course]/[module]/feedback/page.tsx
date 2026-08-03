import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { getCourse, getModule } from "@/lib/content";
import { LearnLayout } from "@/components/playground/learn-layout";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = {
  params: Promise<{ course: string; module: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;
  const mod = getModule(courseSlug, moduleSlug);
  return { title: mod ? `${mod.meta.title} Feedback · Technical Training` : "Not found" };
}

export default async function FeedbackPage({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;

  const course = getCourse(courseSlug);
  const mod = getModule(courseSlug, moduleSlug);
  if (!course || !mod) notFound();

  const session = await auth();
  if (session?.user?.role !== "INSTRUCTOR") {
    notFound();
  }

  const feedbackList = await db.lessonFeedback.findMany({
    where: {
      courseSlug,
      moduleSlug,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalRatings = feedbackList.length;
  const averageRating =
    totalRatings > 0
      ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / totalRatings
      : 0;

  const ratingDistribution = [0, 0, 0, 0, 0];
  feedbackList.forEach((f) => {
    ratingDistribution[f.rating - 1]++;
  });

  const commentsWithRating = feedbackList.filter((f) => f.comment);

  return (
    <LearnLayout courseSlug={courseSlug} sandboxType={course.sandboxType}>
      <div className="mb-6">
        <Link
          href={`/courses/${courseSlug}/${moduleSlug}`}
          className="flex items-center gap-1 text-foreground-secondary hover:text-accent transition-colors text-sm mb-4"
        >
          <ArrowLeft size={14} /> Back to lesson
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Lesson Feedback</h1>
        <p className="text-foreground-secondary">{mod.meta.title}</p>
      </div>

      {totalRatings === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-6 text-center">
          <p className="text-foreground-secondary">No feedback yet</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary Stats */}
          <div className="rounded-lg border border-border bg-surface-raised p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={20}
                      className={`${
                        i < Math.round(averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-semibold">
                  {averageRating.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-foreground-secondary">
                {totalRatings} {totalRatings === 1 ? "response" : "responses"}
              </p>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-3">
                  <div className="flex gap-0.5 w-8">
                    {[...Array(stars)].map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className="fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400"
                      style={{
                        width: `${
                          totalRatings > 0
                            ? (ratingDistribution[stars - 1] / totalRatings) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted w-12 text-right">
                    {ratingDistribution[stars - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments Section */}
          {commentsWithRating.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-raised p-6">
              <h2 className="text-lg font-semibold mb-4">Student Comments</h2>
              <div className="space-y-4">
                {commentsWithRating.map((feedback) => (
                  <div key={feedback.id} className="border-b border-border pb-4 last:border-b-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{feedback.user.name}</p>
                        <p className="text-xs text-muted">{feedback.user.email}</p>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(feedback.rating)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className="fill-yellow-400 text-yellow-400"
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-foreground-secondary">{feedback.comment}</p>
                    <p className="text-xs text-muted mt-2">
                      {feedback.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </LearnLayout>
  );
}
