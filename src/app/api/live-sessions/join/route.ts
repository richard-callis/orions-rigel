import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeRoomCode } from "@/lib/room-code";

const joinSchema = z.object({ roomCode: z.string().min(1) });

// Looks up a live session by its human-typed room code (Jackbox-style
// join) and records attendance for the signed-in user. Returns where to
// redirect (course/module) rather than the session itself — the caller
// then hits /present/[course]/[module] like any other entry point.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = joinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const roomCode = normalizeRoomCode(parsed.data.roomCode);
  const liveSession = await db.liveSession.findFirst({
    where: { roomCode, isActive: true },
  });

  if (!liveSession) {
    return NextResponse.json({ error: "No live session with that code" }, { status: 404 });
  }

  await db.liveSessionAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId: liveSession.id, userId: session.user.id } },
    create: { liveSessionId: liveSession.id, userId: session.user.id },
    update: {},
  });

  return NextResponse.json({
    courseSlug: liveSession.courseSlug,
    moduleSlug: liveSession.moduleSlug,
  });
}
