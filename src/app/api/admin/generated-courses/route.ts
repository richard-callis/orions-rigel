import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";
import { courseSlugExists } from "@/lib/content";

const SLUG = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

const schema = z.object({
  courseSlug: SLUG,
  courseTitle: z.string().trim().min(1).max(120),
  courseDescription: z.string().trim().min(1).max(1000),
  courseTagline: z.string().trim().max(200).optional(),
  sandboxType: z.enum(["sql", "yaml"]),
  moduleSlug: SLUG,
  moduleTitle: z.string().trim().min(1).max(120),
  moduleDescription: z.string().trim().max(500).optional(),
  level: z.enum(["setup", "foundations", "intermediate", "mastery", "reference"]),
  duration: z.string().trim().max(50).optional(),
  content: z.string().trim().min(1).max(50_000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (await courseSlugExists(data.courseSlug)) {
    return NextResponse.json(
      { error: `"${data.courseSlug}" is already taken by another course` },
      { status: 409 }
    );
  }

  const course = await db.generatedCourse.create({
    data: {
      slug: data.courseSlug,
      title: data.courseTitle,
      description: data.courseDescription,
      tagline: data.courseTagline || null,
      sandboxType: data.sandboxType,
      createdById: session.user.id,
      modules: {
        create: {
          slug: data.moduleSlug,
          order: 1,
          title: data.moduleTitle,
          description: data.moduleDescription || "",
          level: data.level,
          duration: data.duration || null,
          content: data.content,
          createdById: session.user.id,
        },
      },
    },
  });

  return NextResponse.json({ course }, { status: 201 });
}
