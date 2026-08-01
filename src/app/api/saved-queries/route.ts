import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const courseSlug = new URL(request.url).searchParams.get("courseSlug");
  if (!courseSlug) {
    return NextResponse.json({ error: "courseSlug is required" }, { status: 400 });
  }

  const queries = await db.savedQuery.findMany({
    where: { userId: session.user.id, courseSlug },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ queries });
}

const createSchema = z.object({
  courseSlug: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(100),
  content: z.string().min(1, "Query is empty"),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const query = await db.savedQuery.create({
    data: { userId: session.user.id, ...parsed.data },
  });

  return NextResponse.json({ query }, { status: 201 });
}
