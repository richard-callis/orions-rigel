import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — no auth required to view. Only name is exposed (not email); this
// ranks by speed first (runtimeMs ascending) since that's the primary
// competitive signal, with planCost/attempts shown alongside for context
// rather than folded into a single opaque score.
export async function GET(request: Request) {
  const challengeId = new URL(request.url).searchParams.get("challengeId");
  if (!challengeId) {
    return NextResponse.json({ error: "challengeId is required" }, { status: 400 });
  }

  const submissions = await db.challengeSubmission.findMany({
    where: { challengeId, passed: true },
    orderBy: { runtimeMs: "asc" },
    select: {
      runtimeMs: true,
      planCost: true,
      attempts: true,
      updatedAt: true,
      user: { select: { name: true } },
    },
  });

  const leaderboard = submissions.map((s, i) => ({
    rank: i + 1,
    name: s.user.name,
    runtimeMs: s.runtimeMs,
    planCost: s.planCost,
    attempts: s.attempts,
    solvedAt: s.updatedAt,
  }));

  return NextResponse.json({ leaderboard });
}
