import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const deleteSchema = z.object({
  deleteData: z.boolean(),
  confirm: z.literal("DELETE"),
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  // Refuse to let the last admin delete themselves — that would leave the
  // platform with no one able to assign roles, same rationale as blocking
  // a self-demotion in /api/admin/users/[id].
  if (session.user.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "You're the only admin — promote someone else to admin first." },
        { status: 400 }
      );
    }
  }

  if (parsed.data.deleteData) {
    // Hard delete — cascades to progress, saved queries, and quiz responses.
    await db.user.delete({ where: { id: session.user.id } });
  } else {
    // Anonymize instead of deleting the row: scrubs the identity (name,
    // email, password, role) but keeps the row itself so historical
    // progress/saved queries/quiz responses stay attributed to it rather
    // than orphaning or cascading them away.
    const randomPassword = await bcrypt.hash(randomUUID(), 12);
    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: "Deleted user",
        email: `deleted-${session.user.id}@deleted.invalid`,
        passwordHash: randomPassword,
        role: "STUDENT",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
