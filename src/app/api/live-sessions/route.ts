import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";
import { generateRoomCode } from "@/lib/room-code";
import { getAnyCourseModules } from "@/lib/content";

// Poll target for the presentation deck — both the instructor (to resume
// their own session or notice a conflicting one) and viewers (to cap
// forward navigation) hit this. Pass history=true to instead list past
// (ended) sessions for the module, for the replay list. With no
// courseSlug/moduleSlug at all, lists every currently-live session across
// every course — this is what the site-wide "live now" banner polls.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug");
  const moduleSlug = url.searchParams.get("moduleSlug");

  if (!courseSlug && !moduleSlug) {
    const sessions = await db.liveSession.findMany({
      where: { isActive: true },
      select: { id: true, courseSlug: true, moduleSlug: true, roomCode: true, startedAt: true },
      orderBy: { startedAt: "desc" },
    });
    return NextResponse.json({ sessions });
  }

  if (!courseSlug || !moduleSlug) {
    return NextResponse.json({ error: "courseSlug and moduleSlug are required" }, { status: 400 });
  }

  if (url.searchParams.get("history") === "true") {
    const sessions = await db.liveSession.findMany({
      where: { courseSlug, moduleSlug, isActive: false },
      select: { id: true, startedAt: true, endedAt: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    return NextResponse.json({ sessions });
  }

  const session = await db.liveSession.findFirst({
    where: { courseSlug, moduleSlug, isActive: true },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ session });
}

const startSchema = z.object({
  courseSlug: z.string().min(1),
  moduleSlug: z.string().min(1),
});

export async function POST(request: Request) {
  const authSession = await auth();
  if (!authSession?.user || !canInstruct(authSession.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { courseSlug, moduleSlug } = parsed.data;

  // Reject a nonexistent module up front — otherwise a mistyped/stale slug
  // silently creates a session that can never be found by /present/[course]/
  // [module], and /advance's own module-list check would make leaving this
  // module fail to credit attendedLive with no error surfaced anywhere.
  const modules = await getAnyCourseModules(courseSlug);
  if (!modules.some((m) => m.slug === moduleSlug)) {
    return NextResponse.json({ error: "Module not found in this course" }, { status: 400 });
  }

  // Only one live session per module at a time.
  await db.liveSession.updateMany({
    where: { courseSlug, moduleSlug, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  // roomCode is only unique among isActive sessions (see schema), so a
  // handful of retries on collision is enough in practice.
  let session = null;
  for (let attempt = 0; attempt < 5 && !session; attempt++) {
    try {
      session = await db.liveSession.create({
        data: { courseSlug, moduleSlug, instructorId: authSession.user.id, roomCode: generateRoomCode() },
      });
    } catch (err: unknown) {
      if (attempt === 4) throw err;
    }
  }

  return NextResponse.json({ session });
}
