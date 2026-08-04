import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Public — no auth required to view the active challenge, only to submit.
// solutionSql/checkQuery are deliberately never selected here; leaking
// either one leaks the answer key.
export async function GET() {
  const challenge = await db.weeklyChallenge.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      difficulty: true,
      language: true,
      tags: true,
      schemaSql: true,
      weekOf: true,
    },
  });

  if (!challenge) {
    return NextResponse.json({ challenge: null });
  }

  const session = await auth();
  let mySubmission = null;
  if (session?.user) {
    mySubmission = await db.challengeSubmission.findUnique({
      where: { challengeId_userId: { challengeId: challenge.id, userId: session.user.id } },
      select: { sql: true, passed: true, runtimeMs: true, planCost: true, attempts: true, errorMessage: true },
    });
  }

  return NextResponse.json({ challenge, mySubmission });
}
