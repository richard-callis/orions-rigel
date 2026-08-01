import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Self-serve role toggle. There's no admin panel or invite flow for this
// internal training tool — anyone can flip themselves to INSTRUCTOR to
// drive a live session or activate quizzes, then flip back.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const role = current.role === "INSTRUCTOR" ? "STUDENT" : "INSTRUCTOR";
  await db.user.update({ where: { id: session.user.id }, data: { role } });

  return NextResponse.json({ role });
}
