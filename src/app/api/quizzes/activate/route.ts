import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";

const schema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
  quizKey: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { courseSlug, moduleSlug, quizKey } = parsed.data;

  // Only one live quiz per module at a time — close anything still open.
  await db.activeQuiz.updateMany({
    where: { courseSlug, moduleSlug, closedAt: null },
    data: { closedAt: new Date() },
  });

  const active = await db.activeQuiz.create({
    data: { courseSlug, moduleSlug, quizKey, activatedBy: session.user.id },
  });

  return NextResponse.json({
    active: { id: active.id, activatedAt: active.activatedAt, closedAt: active.closedAt },
    tally: [],
    total: 0,
    myResponse: null,
  });
}
