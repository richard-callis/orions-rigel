import Anthropic from "@anthropic-ai/sdk";
import { gradeSqlSubmission } from "./grade-sql-challenge";

export type GeneratedChallengeDraft = {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  schemaSql: string;
  solutionSql: string;
  checkQuery: string;
  requireOrder: boolean;
};

const DIFFICULTIES: GeneratedChallengeDraft["difficulty"][] = ["easy", "medium", "hard"];

const SYSTEM_PROMPT = `You write weekly SQL challenge problems for a competitive leaderboard on a technical training platform — think an Alteryx Weekly Challenge, but for SQL/ETL-style problems against a Postgres sandbox.

You must produce, as a single tool call:
- A problem statement in Markdown (the "description") that gives a realistic scenario and a precise, unambiguous task. State exactly what columns/rows the correct answer should return.
- "schemaSql": CREATE TABLE + INSERT statements that seed a small (dozens to low hundreds of rows, not more) but realistic dataset the problem is about. This is the entire sandbox a submission runs against — nothing else exists.
- "solutionSql": a single correct SELECT (or WITH ... SELECT) statement that solves the problem as you described it.
- "checkQuery": a single correct SELECT (or WITH ... SELECT) statement whose result set defines "correct" — this is what a submission's output gets compared against. It is usually identical to solutionSql, but can differ in presentation as long as it produces the same information.
- "requireOrder": true only if the row order in your problem statement is meaningfully part of the answer (e.g. "in descending order of X"); false if any row order should be accepted.

Every field must be internally consistent: solutionSql and checkQuery must both actually run against schemaSql and produce the result the description promises. Only a single SELECT statement is permitted for solutionSql and checkQuery — no DDL/DML, no stacked statements.`;

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
        schemaSql: { type: "string", description: "CREATE TABLE + INSERT statements seeding the sandbox." },
        solutionSql: { type: "string", description: "A single correct SELECT statement solving the problem." },
        checkQuery: { type: "string", description: "A single correct SELECT statement defining the expected result set." },
        requireOrder: { type: "boolean", description: "Whether row order in the result matters." },
      },
      required: ["title", "description", "difficulty", "schemaSql", "solutionSql", "checkQuery", "requireOrder"],
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

  // Self-check: actually run solutionSql against schemaSql and grade it
  // against checkQuery, the same way a real submission would be graded.
  // Claude can generate schemaSql/solutionSql/checkQuery that look
  // consistent but don't actually agree once executed — catch that before
  // an instructor reviews a draft that's broken in a way prose can't show.
  const selfCheck = await gradeSqlSubmission({
    schemaSql: draft.schemaSql,
    checkQuery: draft.checkQuery,
    requireOrder: draft.requireOrder,
    submittedSql: draft.solutionSql,
  });
  if (!selfCheck.passed) {
    throw new Error(
      `Generated draft failed its own self-check (solutionSql doesn't match checkQuery when run against schemaSql): ${selfCheck.errorMessage ?? "unknown mismatch"}. Try generating again.`,
    );
  }

  return draft;
}
