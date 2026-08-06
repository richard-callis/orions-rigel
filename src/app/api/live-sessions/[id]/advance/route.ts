import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAnyCourseModules } from "@/lib/content";

type Props = { params: Promise<{ id: string }> };

const advanceSchema = z.object({ moduleSlug: z.string().min(1) });

// Moves a live session forward to the next module in the course, in one
// atomic step: ends the current module's session and starts a new one for
// the next module, reusing the SAME roomCode and instructorId, and copying
// every current attendee over immediately. This is what lets a class move
// module-to-module without students re-joining or re-typing a code — see
// slide-deck.tsx's auto-follow effect, which detects the handoff via
// /api/live-sessions/by-room.
export async function POST(request: Request, { params }: Props) {
  const authSession = await auth();
  if (!authSession?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = advanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await db.liveSession.findFirst({
    where: { id, instructorId: authSession.user.id, isActive: true },
    include: { attendances: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const modules = await getAnyCourseModules(existing.courseSlug);
  const nextModule = modules.find((m) => m.slug === parsed.data.moduleSlug);
  if (!nextModule) {
    return NextResponse.json({ error: "Module not found in this course" }, { status: 400 });
  }

  const newSession = await db.$transaction(async (tx) => {
    await tx.liveSession.update({
      where: { id: existing.id },
      data: { isActive: false, endedAt: new Date() },
    });

    // Collective credit: the class moved on as a group, so everyone who was
    // following gets the module marked complete even if their own client
    // hadn't individually paged to its last slide yet.
    if (existing.attendances.length > 0) {
      await tx.lessonProgress.createMany({
        data: existing.attendances.map((a) => ({
          userId: a.userId,
          courseSlug: existing.courseSlug,
          moduleSlug: existing.moduleSlug,
          attendedLive: true,
        })),
        skipDuplicates: true,
      });
      // createMany + skipDuplicates won't set attendedLive on a row that
      // already existed (e.g. from self-study) — force it on explicitly.
      await tx.lessonProgress.updateMany({
        where: {
          courseSlug: existing.courseSlug,
          moduleSlug: existing.moduleSlug,
          userId: { in: existing.attendances.map((a) => a.userId) },
        },
        data: { attendedLive: true },
      });
    }

    // Mirror goLive()'s "only one live session per module" invariant in
    // case something else was already live on the destination module.
    await tx.liveSession.updateMany({
      where: { courseSlug: existing.courseSlug, moduleSlug: nextModule.slug, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    const created = await tx.liveSession.create({
      data: {
        courseSlug: existing.courseSlug,
        moduleSlug: nextModule.slug,
        instructorId: existing.instructorId,
        roomCode: existing.roomCode,
      },
    });

    if (existing.attendances.length > 0) {
      await tx.liveSessionAttendance.createMany({
        data: existing.attendances.map((a) => ({
          liveSessionId: created.id,
          userId: a.userId,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return NextResponse.json({ session: newSession });
}
