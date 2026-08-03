import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const toggleSchema = z.object({
  questionId: z.string().min(1),
});

// Toggle the current user's upvote on a question.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { questionId } = parsed.data;

  // Check if question exists
  const question = await db.liveQuestion.findUnique({ where: { id: questionId } });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Check if user has already upvoted
  const existingUpvote = await db.liveQuestionUpvote.findUnique({
    where: { questionId_userId: { questionId, userId: session.user.id } },
  });

  let hasUserUpvoted = false;
  if (existingUpvote) {
    // Delete the upvote
    await db.liveQuestionUpvote.delete({ where: { id: existingUpvote.id } });
  } else {
    // Create the upvote
    await db.liveQuestionUpvote.create({
      data: { questionId, userId: session.user.id },
    });
    hasUserUpvoted = true;
  }

  // Get updated question with upvote count
  const updated = await db.liveQuestion.findUnique({
    where: { id: questionId },
    include: { upvotes: true },
  });

  if (!updated) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    text: updated.text,
    answered: updated.answered,
    createdAt: updated.createdAt,
    upvoteCount: updated.upvotes.length,
    hasUserUpvoted,
  });
}
