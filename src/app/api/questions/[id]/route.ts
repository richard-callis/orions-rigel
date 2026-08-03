import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  answered: z.boolean(),
});

// Instructor-only: mark a question as answered/unanswered.
export async function PATCH(request: Request, { params }: Props) {
  const session = await auth();
  if (session?.user?.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { answered } = parsed.data;

  const question = await db.liveQuestion.findUnique({
    where: { id },
    include: { upvotes: true },
  });

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const updated = await db.liveQuestion.update({
    where: { id },
    data: { answered },
    include: { upvotes: true },
  });

  return NextResponse.json({
    id: updated.id,
    text: updated.text,
    answered: updated.answered,
    createdAt: updated.createdAt,
    upvoteCount: updated.upvotes.length,
    hasUserUpvoted: session.user ? updated.upvotes.some((u) => u.userId === session.user!.id) : false,
  });
}
