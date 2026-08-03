import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const upsertSchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

const getSchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { courseSlug, moduleSlug, rating, comment } = parsed.data;

  const feedback = await db.lessonFeedback.upsert({
    where: {
      userId_courseSlug_moduleSlug: {
        userId: session.user.id,
        courseSlug,
        moduleSlug,
      },
    },
    update: {
      rating,
      comment: comment || null,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      courseSlug,
      moduleSlug,
      rating,
      comment: comment || null,
    },
  });

  return NextResponse.json({
    id: feedback.id,
    rating: feedback.rating,
    comment: feedback.comment,
    createdAt: feedback.createdAt,
  });
}

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug");
  const moduleSlug = url.searchParams.get("moduleSlug");

  const parsed = getSchema.safeParse({ courseSlug, moduleSlug });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { courseSlug: validCourseSlug, moduleSlug: validModuleSlug } = parsed.data;

  const feedbackList = await db.lessonFeedback.findMany({
    where: {
      courseSlug: validCourseSlug,
      moduleSlug: validModuleSlug,
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

  return NextResponse.json({
    feedbackList,
    totalRatings,
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
  });
}
