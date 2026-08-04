import Link from "next/link";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";
import { db } from "@/lib/db";
import { ChallengeView } from "@/components/challenges/challenge-view";
import { ChallengeDescription } from "@/components/challenges/challenge-description";
import { SectionTabs } from "@/components/section-tabs";

export const metadata = { title: "Weekly Challenge · Technical Training" };

export default async function ChallengesPage() {
  const session = await auth();
  const tabs = [{ label: "Challenges", href: "/challenges" }];
  if (canInstruct(session?.user?.role)) {
    tabs.push({ label: "Manage", href: "/admin/challenges" });
  }

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
      <div className="w-full mx-auto max-w-3xl px-4 py-12">
        <SectionTabs tabs={tabs} active="/challenges" />
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Weekly Challenge</h1>
          <p className="text-foreground-secondary">
            No challenge is active right now — check back soon.
          </p>
          <Link href="/courses" className="text-accent hover:underline text-sm mt-4 inline-block">
            Back to courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-6xl px-4 py-12">
      <SectionTabs tabs={tabs} active="/challenges" />
      <ChallengeView
        challenge={{ ...challenge, weekOf: challenge.weekOf.toISOString() }}
        descriptionSlot={<ChallengeDescription content={challenge.description} />}
      />
    </div>
  );
}
