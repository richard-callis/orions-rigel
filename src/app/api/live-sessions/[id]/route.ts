import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSessionEvents, type SessionEvent } from "@/lib/session-events";

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  currentSlide: z.number().int().min(0).optional(),
  isActive: z.literal(false).optional(),
});

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const session = await db.liveSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function PATCH(request: Request, { params }: Props) {
  const authSession = await auth();
  if (!authSession?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Scoping to instructorId (not just id) doubles as the ownership check —
  // updating someone else's session just no-ops into a 404.
  const existing = await db.liveSession.findFirst({
    where: { id, instructorId: authSession.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    currentSlide?: number;
    isActive?: false;
    endedAt?: Date;
    sessionEvents?: SessionEvent[];
  } = {};
  if (parsed.data.currentSlide !== undefined) {
    data.currentSlide = parsed.data.currentSlide;
    if (parsed.data.currentSlide !== existing.currentSlide) {
      const events = parseSessionEvents(existing.sessionEvents);
      events.push({
        slideIndex: parsed.data.currentSlide,
        atMs: Date.now() - existing.startedAt.getTime(),
      });
      data.sessionEvents = events;
    }
  }
  if (parsed.data.isActive === false) {
    data.isActive = false;
    data.endedAt = new Date();
  }

  const session = await db.liveSession.update({ where: { id }, data });
  return NextResponse.json({ session });
}
