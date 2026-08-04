import Link from "next/link";
import { db } from "@/lib/db";
import { ChallengeView } from "@/components/challenges/challenge-view";

export const metadata = { title: "Weekly Challenge · Technical Training" };

export default async function ChallengesPage() {
  const challenge = await db.weeklyChallenge.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      difficulty: true,
      schemaSql: true,
      weekOf: true,
    },
  });

  if (!challenge) {
    return (
      <div className="w-full mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Weekly Challenge</h1>
        <p className="text-foreground-secondary">
          No challenge is active right now — check back soon.
        </p>
        <Link href="/courses" className="text-accent hover:underline text-sm mt-4 inline-block">
          Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-6xl px-4 py-12">
      <ChallengeView
        challenge={{ ...challenge, weekOf: challenge.weekOf.toISOString() }}
      />
    </div>
  );
}
