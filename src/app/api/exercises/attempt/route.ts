import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const exerciseKey = new URL(request.url).searchParams.get("exerciseKey");
  if (!exerciseKey) {
    return NextResponse.json({ error: "exerciseKey is required" }, { status: 400 });
  }

  const attempt = await db.exerciseAttempt.findUnique({
    where: { userId_exerciseKey: { userId: session.user.id, exerciseKey } },
  });

  return NextResponse.json({ attempt });
}

const attemptSchema = z.object({
  exerciseKey: z.string().min(1),
  passed: z.boolean(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = attemptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const attempt = await db.exerciseAttempt.upsert({
    where: { userId_exerciseKey: { userId: session.user.id, exerciseKey: parsed.data.exerciseKey } },
    create: {
      userId: session.user.id,
      exerciseKey: parsed.data.exerciseKey,
      passed: parsed.data.passed,
    },
    update: {
      passed: parsed.data.passed,
      attemptedAt: new Date(),
    },
  });

  return NextResponse.json({ attempt }, { status: 200 });
}
