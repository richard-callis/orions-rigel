import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  currentSlide: z.number().int().min(0).optional(),
  isActive: z.literal(false).optional(),
});

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

  const data: { currentSlide?: number; isActive?: false; endedAt?: Date } = {};
  if (parsed.data.currentSlide !== undefined) data.currentSlide = parsed.data.currentSlide;
  if (parsed.data.isActive === false) {
    data.isActive = false;
    data.endedAt = new Date();
  }

  // Scoping to instructorId (not just id) doubles as the ownership check —
  // updating someone else's session just no-ops into a 404.
  const { count } = await db.liveSession.updateMany({
    where: { id, instructorId: authSession.user.id },
    data,
  });

  if (count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await db.liveSession.findUnique({ where: { id } });
  return NextResponse.json({ session });
}
