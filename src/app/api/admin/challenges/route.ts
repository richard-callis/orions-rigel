import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";
import { slugify } from "@/lib/slugify";
import { gradeSqlSubmission, assertHiddenDatasetDiffers } from "@/lib/grade-sql-challenge";

const SLUG = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

const schema = z.object({
  slug: SLUG,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(10_000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  schemaSql: z.string().trim().min(1).max(20_000),
  hiddenSchemaSql: z.string().trim().min(1).max(20_000),
  solutionSql: z.string().trim().min(1).max(5_000),
  checkQuery: z.string().trim().min(1).max(5_000),
  requireOrder: z.boolean(),
  weekOf: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  activate: z.boolean().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const challenges = await db.weeklyChallenge.findMany({
    orderBy: { weekOf: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      weekOf: true,
      isActive: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ challenges });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !canInstruct(session.user.role)) {
    return NextResponse.json({ error: "Instructor only" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".");
    const message = issue ? (field ? `${field}: ${issue.message}` : issue.message) : "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;

  const slug = slugify(data.slug);
  const existing = await db.weeklyChallenge.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: `"${slug}" is already taken by another challenge` }, { status: 409 });
  }

  // Same self-check the AI-generation endpoint runs — required here too
  // since this route also accepts hand-written drafts (see "Write it
  // myself" on the create page), which have no earlier verification pass.
  // Checked against both datasets: hiddenSchemaSql is what real grading
  // uses, but solutionSql/checkQuery need to agree on schemaSql too, since
  // that's the data the problem statement is written against.
  for (const [label, schemaSql] of [
    ["schemaSql", data.schemaSql],
    ["hiddenSchemaSql", data.hiddenSchemaSql],
  ] as const) {
    const check = await gradeSqlSubmission({
      gradingSchemaSql: schemaSql,
      checkQuery: data.checkQuery,
      requireOrder: data.requireOrder,
      submittedSql: data.solutionSql,
    });
    if (!check.passed) {
      return NextResponse.json(
        {
          error: `solutionSql doesn't match checkQuery when run against ${label}: ${check.errorMessage ?? "unknown mismatch"}`,
        },
        { status: 422 },
      );
    }
  }

  try {
    await assertHiddenDatasetDiffers({
      schemaSql: data.schemaSql,
      hiddenSchemaSql: data.hiddenSchemaSql,
      checkQuery: data.checkQuery,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hidden grading data check failed" },
      { status: 422 },
    );
  }

  const result = await db.$transaction(async (tx) => {
    if (data.activate) {
      await tx.weeklyChallenge.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    return tx.weeklyChallenge.create({
      data: {
        slug,
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        schemaSql: data.schemaSql,
        hiddenSchemaSql: data.hiddenSchemaSql,
        solutionSql: data.solutionSql,
        checkQuery: data.checkQuery,
        requireOrder: data.requireOrder,
        weekOf: new Date(data.weekOf),
        isActive: data.activate,
        createdById: session.user.id,
      },
    });
  });

  return NextResponse.json({ challenge: result }, { status: 201 });
}
