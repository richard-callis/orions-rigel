import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gradeSqlSubmission } from "@/lib/grade-sql-challenge";

const schema = z.object({
  challengeId: z.string().min(1),
  sql: z.string().trim().min(1).max(5_000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { challengeId, sql } = parsed.data;

  const challenge = await db.weeklyChallenge.findUnique({
    where: { id: challengeId },
    select: { id: true, isActive: true, schemaSql: true, checkQuery: true, requireOrder: true },
  });
  if (!challenge || !challenge.isActive) {
    return NextResponse.json({ error: "This challenge isn't active" }, { status: 404 });
  }

  // Authoritative server-side grading — see grade-sql-challenge.ts. The
  // submitted SQL never runs against the real app database, only an
  // ephemeral in-memory sandbox seeded fresh for this one grading pass.
  const grade = await gradeSqlSubmission({
    schemaSql: challenge.schemaSql,
    checkQuery: challenge.checkQuery,
    requireOrder: challenge.requireOrder,
    submittedSql: sql,
  });

  const existing = await db.challengeSubmission.findUnique({
    where: { challengeId_userId: { challengeId, userId: session.user.id } },
    select: { passed: true, runtimeMs: true },
  });

  // Keep the user's personal-best passing submission on record. If they've
  // already passed, only overwrite the stored result if this one also
  // passes and is faster; attempts still count either way. If they haven't
  // passed yet, always show their latest attempt.
  const shouldOverwriteResult =
    !existing || !existing.passed || (grade.passed && grade.runtimeMs < existing.runtimeMs);

  const submission = await db.challengeSubmission.upsert({
    where: { challengeId_userId: { challengeId, userId: session.user.id } },
    create: {
      challengeId,
      userId: session.user.id,
      sql,
      passed: grade.passed,
      runtimeMs: grade.runtimeMs,
      planCost: grade.planCost,
      errorMessage: grade.errorMessage,
      attempts: 1,
    },
    update: {
      attempts: { increment: 1 },
      ...(shouldOverwriteResult
        ? {
            sql,
            passed: grade.passed,
            runtimeMs: grade.runtimeMs,
            planCost: grade.planCost,
            errorMessage: grade.errorMessage,
          }
        : {}),
    },
  });

  return NextResponse.json({
    passed: grade.passed,
    runtimeMs: grade.runtimeMs,
    planCost: grade.planCost,
    errorMessage: grade.errorMessage,
    attempts: submission.attempts,
  });
}
