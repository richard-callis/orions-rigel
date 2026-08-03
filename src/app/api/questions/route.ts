import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Poll target for the live Q&A panel — no auth required to view, but includes
// the current user's upvote state if signed in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug");
  const moduleSlug = url.searchParams.get("moduleSlug");
  if (!courseSlug || !moduleSlug) {
    return NextResponse.json(
      { error: "courseSlug and moduleSlug are required" },
      { status: 400 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id;

  const questions = await db.liveQuestion.findMany({
    where: { courseSlug, moduleSlug },
    include: { upvotes: true },
    orderBy: [{ answered: "asc" }, { createdAt: "asc" }],
  });

  const questionsWithCounts = questions.map((q) => ({
    id: q.id,
    text: q.text,
    answered: q.answered,
    createdAt: q.createdAt,
    upvoteCount: q.upvotes.length,
    hasUserUpvoted: userId ? q.upvotes.some((u) => u.userId === userId) : false,
  }));

  // Sort by upvote count (descending), then by creation time (ascending)
  questionsWithCounts.sort((a, b) => {
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1; // unanswered first
    }
    if (b.upvoteCount !== a.upvoteCount) {
      return b.upvoteCount - a.upvoteCount; // more upvotes first
    }
    return a.createdAt.getTime() - b.createdAt.getTime(); // older first
  });

  return NextResponse.json({ questions: questionsWithCounts });
}

const createSchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
  text: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { courseSlug, moduleSlug, text } = parsed.data;

  const question = await db.liveQuestion.create({
    data: { courseSlug, moduleSlug, text, userId: session.user.id },
  });

  return NextResponse.json({
    id: question.id,
    text: question.text,
    answered: question.answered,
    createdAt: question.createdAt,
    upvoteCount: 0,
    hasUserUpvoted: false,
  });
}
