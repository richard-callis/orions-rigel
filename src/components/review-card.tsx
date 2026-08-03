"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewSchedule } from "@/generated/prisma/client";

interface ReviewCardProps {
  review: ReviewSchedule;
  moduleName: string;
  courseName: string;
}

export function ReviewCard({ review, moduleName, courseName }: ReviewCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleReview = async (difficulty: "easy" | "hard") => {
    setLoading(true);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: review.courseSlug,
          moduleSlug: review.moduleSlug,
          difficulty,
        }),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs text-muted mb-1">{courseName}</p>
          <Link
            href={`/courses/${review.courseSlug}/${review.moduleSlug}`}
            className="font-semibold hover:text-accent transition-colors"
          >
            {moduleName}
          </Link>
          <p className="text-sm text-foreground-secondary mt-1">
            Reviewed {review.reviewCount} time{review.reviewCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleReview("easy")}
            disabled={loading}
            className="flex-1 rounded-lg bg-green-600 text-white text-sm px-3 py-2 font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "…" : "✓ Easy"}
          </button>
          <button
            onClick={() => handleReview("hard")}
            disabled={loading}
            className="flex-1 rounded-lg bg-amber-600 text-white text-sm px-3 py-2 font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "…" : "⟲ Hard"}
          </button>
        </div>
      </div>
    </div>
  );
}
