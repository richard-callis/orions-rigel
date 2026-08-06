import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

const attendSchema = z.object({ reachedSlide: z.number().int().min(0) });

// Called by non-instructor viewers while following a live session in
// Present Mode — both to record that they joined at all (Jackbox-style
// attendance, distinct from just reading the module solo later) and to
// track how far they actually got, since "completed" should mean reached
// the last slide, not just opened the tab at some point.
export async function POST(request: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: liveSessionId } = await params;
  const parsed = attendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const liveSession = await db.liveSession.findUnique({ where: { id: liveSessionId } });
  if (!liveSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { reachedSlide } = parsed.data;

  // Create the attendance row if this is the first ping, otherwise leave
  // reachedSlide alone here — it's advanced below, and only forward.
  const attendance = await db.liveSessionAttendance.upsert({
    where: { liveSessionId_userId: { liveSessionId, userId: session.user.id } },
    create: { liveSessionId, userId: session.user.id, reachedSlide },
    update: {},
  });

  // Only ever move reachedSlide forward — a student jumping back to review
  // an earlier slide shouldn't erase how far they'd already gotten.
  if (attendance.reachedSlide < reachedSlide) {
    await db.liveSessionAttendance.update({
      where: { liveSessionId_userId: { liveSessionId, userId: session.user.id } },
      data: { reachedSlide },
    });
  }

  return NextResponse.json({ ok: true });
}
