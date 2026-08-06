import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

// A "still watching" heartbeat, sent on an interval by non-instructor
// viewers in Present Mode. GET returns the current live viewer count
// (lastSeenAt within the last 30s) — Twitch-style "N watching," distinct
// from total attendance which never shrinks.
const PRESENCE_WINDOW_MS = 30_000;

export async function POST(_request: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: liveSessionId } = await params;

  const liveSession = await db.liveSession.findUnique({
    where: { id: liveSessionId },
    select: { instructorId: true },
  });
  if (!liveSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // The instructor is never counted as a viewer of their own session — a
  // heartbeat from them would otherwise flow into attendedLive credit and
  // the attendance list (see /api/live-sessions/[id]/advance). The client
  // already avoids sending this, but don't rely on that alone.
  if (liveSession.instructorId === session.user.id) {
    return NextResponse.json({ ok: true });
  }

  await db.liveSessionAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId, userId: session.user.id } },
    create: { liveSessionId, userId: session.user.id },
    update: { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: Props) {
  const { id: liveSessionId } = await params;
  const since = new Date(Date.now() - PRESENCE_WINDOW_MS);

  const [count, recent] = await Promise.all([
    db.liveSessionAttendance.count({
      where: { liveSessionId, lastSeenAt: { gte: since } },
    }),
    db.liveSessionAttendance.findMany({
      where: { liveSessionId, lastSeenAt: { gte: since } },
      select: { user: { select: { name: true } } },
      take: 8,
      orderBy: { lastSeenAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    count,
    names: recent.map((r) => r.user.name),
  });
}
