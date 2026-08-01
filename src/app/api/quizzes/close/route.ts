import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tallyOf } from "@/lib/quiz-tally";

const schema = z.object({ activeQuizId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const active = await db.activeQuiz.update({
    where: { id: parsed.data.activeQuizId },
    data: { closedAt: new Date() },
    include: { responses: true },
  });

  return NextResponse.json({
    active: { id: active.id, activatedAt: active.activatedAt, closedAt: active.closedAt },
    tally: tallyOf(active.responses),
    total: active.responses.length,
    myResponse: null,
  });
}
