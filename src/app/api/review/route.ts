import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
  difficulty: z.enum(["easy", "hard"]),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { courseSlug, moduleSlug, difficulty } = parsed.data;

  // Find the review schedule
  const review = await db.reviewSchedule.findUnique({
    where: {
      userId_courseSlug_moduleSlug: {
        userId: session.user.id,
        courseSlug,
        moduleSlug,
      },
    },
  });

  if (!review) {
    return NextResponse.json(
      { error: "Review schedule not found" },
      { status: 404 }
    );
  }

  // Calculate new interval and due date using SM-2-lite algorithm.
  // Easy: increase interval (double it or add 7 days minimum growth).
  // Hard: reset to 1 day.
  let newIntervalDays = review.intervalDays;
  if (difficulty === "easy") {
    // Increase interval: double it, but ensure at least +7 day growth
    newIntervalDays = Math.max(
      review.intervalDays * 2,
      review.intervalDays + 7
    );
  } else if (difficulty === "hard") {
    // Reset to 1 day on hard rating
    newIntervalDays = 1;
  }

  const newDueAt = new Date();
  newDueAt.setDate(newDueAt.getDate() + newIntervalDays);

  // Update the review schedule
  await db.reviewSchedule.update({
    where: {
      userId_courseSlug_moduleSlug: {
        userId: session.user.id,
        courseSlug,
        moduleSlug,
      },
    },
    data: {
      dueAt: newDueAt,
      intervalDays: newIntervalDays,
      reviewCount: review.reviewCount + 1,
      lastReviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
