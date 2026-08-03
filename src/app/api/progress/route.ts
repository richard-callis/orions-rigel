import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
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

  const { courseSlug, moduleSlug } = parsed.data;

  await db.lessonProgress.upsert({
    where: {
      userId_courseSlug_moduleSlug: { userId: session.user.id, courseSlug, moduleSlug },
    },
    create: { userId: session.user.id, courseSlug, moduleSlug },
    update: {},
  });

  // Create or reschedule review for spaced repetition.
  // Initial review is due after 1 day.
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);

  await db.reviewSchedule.upsert({
    where: {
      userId_courseSlug_moduleSlug: { userId: session.user.id, courseSlug, moduleSlug },
    },
    create: {
      userId: session.user.id,
      courseSlug,
      moduleSlug,
      dueAt,
      intervalDays: 1,
      reviewCount: 0,
    },
    update: {
      dueAt,
      intervalDays: 1,
      reviewCount: 0,
      lastReviewedAt: null,
    },
  });

  return NextResponse.json({ completed: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { courseSlug, moduleSlug } = parsed.data;

  await db.lessonProgress.deleteMany({
    where: { userId: session.user.id, courseSlug, moduleSlug },
  });

  return NextResponse.json({ completed: false });
}
