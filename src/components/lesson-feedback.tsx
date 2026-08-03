"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MessageCircle, Star, Loader2 } from "lucide-react";

interface LessonFeedbackProps {
  courseSlug: string;
  moduleSlug: string;
  initialRating?: number | null;
  initialComment?: string | null;
}

export function LessonFeedback({
  courseSlug,
  moduleSlug,
  initialRating,
  initialComment,
}: LessonFeedbackProps) {
  const { status } = useSession();
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [comment, setComment] = useState(initialComment ?? "");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(initialRating));
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  if (status === "loading") return null;

  if (status !== "authenticated") {
    return (
      <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm">
        <Link href="/login" className="text-accent hover:underline">
          Sign in to leave feedback
        </Link>
      </div>
    );
  }

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;

    setPending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          moduleSlug,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } finally {
      setPending(false);
    }
  }

  if (submitted && !pending) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4">
        <p className="text-sm text-success font-medium">
          Thank you for your feedback!
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitFeedback}
      className="rounded-lg border border-border bg-surface-raised p-4 space-y-4"
    >
      <div>
        <label className="text-sm font-medium block mb-2">How was this lesson?</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(null)}
              className="transition-transform hover:scale-110"
              disabled={pending}
            >
              <Star
                size={24}
                className={`${
                  (hoverRating ?? rating ?? 0) >= star
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-2 flex items-center gap-1.5">
          <MessageCircle size={14} /> Additional comments (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What could we improve?"
          maxLength={500}
          disabled={pending}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 resize-none"
          rows={3}
        />
        <p className="text-xs text-muted mt-1">
          {comment.length}/500
        </p>
      </div>

      <button
        type="submit"
        disabled={!rating || pending}
        className="w-full rounded-lg bg-accent text-background font-medium px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        Submit Feedback
      </button>
    </form>
  );
}
