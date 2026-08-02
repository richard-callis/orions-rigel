import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";

type Props = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  role: z.enum([Role.STUDENT, Role.INSTRUCTOR, Role.ADMIN]),
});

export async function PATCH(request: Request, { params }: Props) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Refuse to demote the last remaining admin — otherwise no one left with
  // access could ever assign roles again.
  if (target.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Can't remove the last admin" }, { status: 400 });
    }
  }

  const user = await db.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
