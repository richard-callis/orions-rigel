import Anthropic from "@anthropic-ai/sdk";
import { gradeSqlSubmission, assertHiddenDatasetDiffers } from "./grade-sql-challenge";

export type GeneratedChallengeDraft = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  schemaSql: string;
  hiddenSchemaSql: string;
  solutionSql: string;
  checkQuery: string;
  requireOrder: boolean;
};

const DIFFICULTIES: GeneratedChallengeDraft["difficulty"][] = ["easy", "medium", "hard"];

const SYSTEM_PROMPT = `You write weekly SQL challenge problems for a competitive leaderboard on a technical training platform — think an Alteryx Weekly Challenge, but for SQL/ETL-style problems against a Postgres sandbox.

You must produce, as a single tool call:
- A problem statement in Markdown (the "description") that gives a realistic scenario and a precise, unambiguous task. State exactly what columns/rows the correct answer should return.
- "schemaSql": CREATE TABLE + INSERT statements seeding a small (dozens to low hundreds of rows, not more) but realistic dataset. Students see this data and can freely explore it in their own practice sandbox before submitting.
- "hiddenSchemaSql": a SECOND, separate CREATE TABLE + INSERT statement set with the EXACT same table and column names/types as schemaSql, but DIFFERENT row values (different names, different amounts, a different number of rows even). This is what a submission is actually graded against, and students never see it. The reason: without a second dataset, a student could solve the problem once by reading the visible rows and then submit a query that just hardcodes those literal values instead of computing them — that would pass and even look "instant" on the leaderboard. A genuinely correct query produces the right answer on both datasets; a hardcoded one only works on the one whose values it copied.
- "solutionSql": a single correct SELECT (or WITH ... SELECT) statement that solves the problem as described, using only the table/column structure — not depending on any specific row values from schemaSql, since it will also run unmodified against hiddenSchemaSql.
- "checkQuery": a single correct SELECT (or WITH ... SELECT) statement whose result set defines "correct" — this is what a submission's output gets compared against, run against whichever dataset is currently loaded. Usually identical to solutionSql, but can differ in presentation as long as it produces the same information.
- "requireOrder": true only if the row order in your problem statement is meaningfully part of the answer (e.g. "in descending order of X"); false if any row order should be accepted.

Every field must be internally consistent: solutionSql and checkQuery must both actually run — and agree with each other — against EITHER schemaSql or hiddenSchemaSql, since grading always uses hiddenSchemaSql but the problem statement is written against schemaSql's example data. Only a single SELECT statement is permitted for solutionSql and checkQuery — no DDL/DML, no stacked statements.`;

function toolSchema() {
  return {
    name: "create_challenge",
    description: "Create one weekly SQL challenge for the platform.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short, punchy title for the challenge." },
        description: { type: "string", description: "The full problem statement in Markdown." },
        difficulty: { type: "string", enum: DIFFICULTIES },
        schemaSql: { type: "string", description: "CREATE TABLE + INSERT statements seeding the public/example sandbox students explore." },
        hiddenSchemaSql: {
          type: "string",
          description: "Same table/column structure as schemaSql, different row values — the actual dataset submissions are graded against. Never shown to students.",
        },
        solutionSql: { type: "string", description: "A single correct SELECT statement solving the problem, valid against either dataset." },
        checkQuery: { type: "string", description: "A single correct SELECT statement defining the expected result set." },
        requireOrder: { type: "boolean", description: "Whether row order in the result matters." },
      },
      required: [
        "title",
        "description",
        "difficulty",
        "schemaSql",
        "hiddenSchemaSql",
        "solutionSql",
        "checkQuery",
        "requireOrder",
      ],
    },
  };
}

export async function generateChallenge(params: {
  topic: string;
  difficulty: GeneratedChallengeDraft["difficulty"];
}): Promise<GeneratedChallengeDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — AI challenge creation needs it configured as an env var.",
    );
  }

  const client = new Anthropic({ apiKey });
  const tool = toolSchema();

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: "create_challenge" },
    messages: [
      {
        role: "user",
        content: `Write a weekly SQL challenge on: ${params.topic}\n\nTarget difficulty: ${params.difficulty}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The model didn't return a structured challenge — try again.");
  }

  const draft = toolUse.input as GeneratedChallengeDraft;

  // Self-check: actually run solutionSql and grade it against checkQuery,
  // the same way a real submission would be graded — against BOTH
  // datasets, since solutionSql/checkQuery need to agree on either (real
  // grading always uses hiddenSchemaSql, but this also catches a
  // solutionSql that only happens to work against one specific dataset,
  // e.g. one relying on incidental row order without requireOrder). Claude
  // can generate fields that look consistent but don't actually agree once
  // executed — catch that before an instructor reviews a broken draft.
  for (const [label, schemaSql] of [
    ["schemaSql", draft.schemaSql],
    ["hiddenSchemaSql", draft.hiddenSchemaSql],
  ] as const) {
    const selfCheck = await gradeSqlSubmission({
      gradingSchemaSql: schemaSql,
      checkQuery: draft.checkQuery,
      requireOrder: draft.requireOrder,
      submittedSql: draft.solutionSql,
    });
    if (!selfCheck.passed) {
      throw new Error(
        `Generated draft failed its own self-check against ${label} (solutionSql doesn't match checkQuery): ${selfCheck.errorMessage ?? "unknown mismatch"}. Try generating again.`,
      );
    }
  }

  // Also confirm the two datasets are actually different — Claude
  // generating hiddenSchemaSql as a near-copy of schemaSql would pass
  // every check above while defeating the entire point of the field.
  await assertHiddenDatasetDiffers({
    schemaSql: draft.schemaSql,
    hiddenSchemaSql: draft.hiddenSchemaSql,
    checkQuery: draft.checkQuery,
  });

  return draft;
}
