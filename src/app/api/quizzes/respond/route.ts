import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tallyOf } from "@/lib/quiz-tally";

const schema = z.object({
  activeQuizId: z.string().min(1),
  selectedIndex: z.number().int().min(0),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { activeQuizId, selectedIndex } = parsed.data;

  const active = await db.activeQuiz.findUnique({ where: { id: activeQuizId } });
  if (!active || active.closedAt) {
    return NextResponse.json({ error: "This quiz isn't open" }, { status: 409 });
  }

  await db.quizResponse.upsert({
    where: { activeQuizId_userId: { activeQuizId, userId: session.user.id } },
    create: { activeQuizId, userId: session.user.id, selectedIndex },
    update: { selectedIndex },
  });

  const responses = await db.quizResponse.findMany({ where: { activeQuizId } });

  return NextResponse.json({
    active: { id: active.id, activatedAt: active.activatedAt, closedAt: active.closedAt },
    tally: tallyOf(responses),
    total: responses.length,
    myResponse: selectedIndex,
  });
}
