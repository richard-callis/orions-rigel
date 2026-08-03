import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";
import { generateTraining } from "@/lib/generate-training";

const schema = z.object({
  topic: z.string().trim().min(3, "Describe the topic in a bit more detail").max(500),
  sandboxType: z.enum(["sql", "yaml"]),
  level: z.enum(["setup", "foundations", "intermediate", "mastery", "reference"]),
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

  try {
    const draft = await generateTraining(parsed.data);
    return NextResponse.json({ draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
