import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { lockAdminCount } from "@/lib/admin-guard";

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

  const result = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) {
      return { error: "Not found", status: 404 } as const;
    }

    // Refuse to demote the last remaining admin — otherwise no one left
    // with access could ever assign roles again. Locked so two concurrent
    // demotions (of two different admins) can't both see "more than one
    // admin" and both proceed, leaving zero.
    if (target.role === "ADMIN" && parsed.data.role !== "ADMIN") {
      await lockAdminCount(tx);
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return { error: "Can't remove the last admin", status: 400 } as const;
      }
    }

    const user = await tx.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return { user };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ user: result.user });
}

const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
});

export async function DELETE(request: Request, { params }: Props) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  // This endpoint always hard-deletes with no anonymize option — the UI
  // hides the delete button for your own row, but a direct API call would
  // otherwise bypass that and skip the anonymize choice /api/account offers
  // for self-deletion. Route it there instead.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Use account settings to delete your own account" },
      { status: 400 },
    );
  }

  const result = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) {
      return { error: "Not found", status: 404 } as const;
    }

    // Same last-admin guard as the role-change path above — deleting the
    // last admin would leave the platform with no one able to assign
    // roles or delete anyone else.
    if (target.role === "ADMIN") {
      await lockAdminCount(tx);
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return { error: "Can't remove the last admin", status: 400 } as const;
      }
    }

    // Hard delete — cascades to progress, saved queries, quiz responses,
    // and exercise attempts via the schema's onDelete: Cascade relations.
    // Unlike self-service deletion (/api/account), there's no anonymize
    // option here: an admin removing another member's account removes
    // the member and all their data, full stop.
    await tx.user.delete({ where: { id } });
    return { ok: true } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
