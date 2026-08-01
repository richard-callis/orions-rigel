import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tallyOf } from "@/lib/quiz-tally";

// Poll target for the <Quiz> MDX component. The question/options/answer
// live in the MDX content itself, not the DB — this only reports whether
// a quiz is currently live and how responses are trending.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug");
  const moduleSlug = url.searchParams.get("moduleSlug");
  const quizKey = url.searchParams.get("quizKey");
  if (!courseSlug || !moduleSlug || !quizKey) {
    return NextResponse.json(
      { error: "courseSlug, moduleSlug, quizKey are required" },
      { status: 400 }
    );
  }

  const active = await db.activeQuiz.findFirst({
    where: { courseSlug, moduleSlug, quizKey },
    orderBy: { activatedAt: "desc" },
    include: { responses: true },
  });

  if (!active) {
    return NextResponse.json({ active: null, tally: [], total: 0, myResponse: null });
  }

  const session = await auth();
  const mine = session?.user
    ? active.responses.find((r) => r.userId === session.user.id)
    : undefined;

  return NextResponse.json({
    active: { id: active.id, activatedAt: active.activatedAt, closedAt: active.closedAt },
    tally: tallyOf(active.responses),
    total: active.responses.length,
    myResponse: mine ? mine.selectedIndex : null,
  });
}
