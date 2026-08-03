import Anthropic from "@anthropic-ai/sdk";
import type { ModuleLevel, SandboxType } from "@/lib/content";

export type GeneratedDraft = {
  courseTitle: string;
  courseDescription: string;
  courseTagline: string;
  moduleTitle: string;
  moduleDescription: string;
  level: ModuleLevel;
  duration: string;
  content: string;
};

const LEVELS: ModuleLevel[] = ["setup", "foundations", "intermediate", "mastery", "reference"];

const SYSTEM_PROMPT = `You write hands-on technical training lessons for an in-browser learning platform. Every lesson is Markdown/MDX rendered next to a live practice console (SQL against a real Postgres sandbox, or YAML validated against common Kubernetes manifest mistakes) and can also be shown full-screen as a slide deck, split into slides at each "##" heading.

Conventions available in the content you write:
- Fenced code blocks tagged \`\`\`sql or \`\`\`yaml render with a "Run"/"Validate" button wired to the live console — use them for every example the learner should actually execute, not just for illustration.
- \`<Callout label="Short label">...markdown...</Callout>\` for asides, caveats, or "why this matters" notes. Use sparingly, for genuinely important asides.
- \`<Quiz id="unique-kebab-id" question="..." options={["A", "B", "C", "D"]} answer={0} />\` (answer is the zero-based index of the correct option) for a single checkpoint quiz — include at most one or two per lesson, placed after the concept they test.
- Structure the lesson with "##" headings as section/slide breaks. Start with 1-2 sentences of context, no heading, before the first "##".

Write for a technically competent adult audience that already has basic familiarity with the topic — skip beginner throat-clearing, be concrete, use realistic examples, and prefer showing over telling. Keep the whole module to what a group could reasonably work through in the given duration.`;

function toolSchema() {
  return {
    name: "create_training",
    description: "Create one training module for the course platform.",
    input_schema: {
      type: "object" as const,
      properties: {
        courseTitle: { type: "string", description: "Title for the course this module belongs to." },
        courseDescription: { type: "string", description: "1-2 sentence course description." },
        courseTagline: { type: "string", description: "A short, punchy one-line tagline for the course." },
        moduleTitle: { type: "string", description: "Title for this specific module/lesson." },
        moduleDescription: { type: "string", description: "1 sentence describing what this module covers." },
        level: { type: "string", enum: LEVELS, description: "Difficulty level of this module." },
        duration: { type: "string", description: 'Estimated time, e.g. "30-45 min".' },
        content: {
          type: "string",
          description: "The full lesson body in Markdown/MDX, following the conventions described in the system prompt.",
        },
      },
      required: [
        "courseTitle",
        "courseDescription",
        "courseTagline",
        "moduleTitle",
        "moduleDescription",
        "level",
        "duration",
        "content",
      ],
    },
  };
}

export async function generateTraining(params: {
  topic: string;
  sandboxType: SandboxType;
  level: ModuleLevel;
}): Promise<GeneratedDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — AI training creation needs it configured as an env var."
    );
  }

  const client = new Anthropic({ apiKey });
  const tool = toolSchema();

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "tool", name: "create_training" },
    messages: [
      {
        role: "user",
        content: `Write a training module on: ${params.topic}

Practice console for this course: ${params.sandboxType === "yaml" ? "Kubernetes YAML manifest validator" : "live SQL against Postgres"}
Target level: ${params.level}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("The model didn't return structured training content — try again.");
  }

  return toolUse.input as GeneratedDraft;
}
