import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Looks up the currently-active session for a room code, regardless of
// which module it's now on. Present Mode polls this (once it knows its
// roomCode) instead of the courseSlug+moduleSlug-scoped GET on
// /api/live-sessions so it can detect the instructor advancing to the next
// module — see /api/live-sessions/[id]/advance — and follow automatically
// instead of the room going dark.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomCode = url.searchParams.get("roomCode");
  if (!roomCode) {
    return NextResponse.json({ error: "roomCode is required" }, { status: 400 });
  }

  const session = await db.liveSession.findFirst({
    where: { roomCode, isActive: true },
  });

  return NextResponse.json({ session });
}
