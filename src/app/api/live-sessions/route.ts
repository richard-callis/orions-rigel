import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";

// Poll target for the presentation deck — both the instructor (to resume
// their own session or notice a conflicting one) and viewers (to cap
// forward navigation) hit this.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const courseSlug = url.searchParams.get("courseSlug");
  const moduleSlug = url.searchParams.get("moduleSlug");
  if (!courseSlug || !moduleSlug) {
    return NextResponse.json({ error: "courseSlug and moduleSlug are required" }, { status: 400 });
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

  // Only one live session per module at a time.
  await db.liveSession.updateMany({
    where: { courseSlug, moduleSlug, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  const session = await db.liveSession.create({
    data: { courseSlug, moduleSlug, instructorId: authSession.user.id },
  });

  return NextResponse.json({ session });
}
