import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  isActive: z.boolean(),
});

// Only one challenge is active at a time — activating this one deactivates
// whichever was active before. Deactivating just turns it off.
export async function PATCH(request: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await db.weeklyChallenge.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const challenge = await db.$transaction(async (tx) => {
    if (parsed.data.isActive) {
      await tx.weeklyChallenge.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }
    return tx.weeklyChallenge.update({ where: { id }, data: { isActive: parsed.data.isActive } });
  });

  return NextResponse.json({ challenge });
}

export async function DELETE(_request: Request, { params }: Props) {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.weeklyChallenge.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cascades to ChallengeSubmission rows via the schema's onDelete: Cascade.
  await db.weeklyChallenge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
