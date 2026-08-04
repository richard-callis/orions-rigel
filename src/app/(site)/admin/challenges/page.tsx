import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canInstruct } from "@/lib/roles";
import { ChallengeList } from "@/components/admin/challenge-list";
import { SectionTabs } from "@/components/section-tabs";

export const metadata = { title: "Manage challenges · Technical Training" };

export default async function AdminChallengesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/challenges");
  if (!canInstruct(session.user.role)) redirect("/dashboard");

  const challenges = await db.weeklyChallenge.findMany({
    orderBy: { weekOf: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      language: true,
      tags: true,
      weekOf: true,
      isActive: true,
      _count: { select: { submissions: true } },
    },
  });

  return (
    <div className="w-full mx-auto max-w-4xl px-4 py-12">
      <SectionTabs
        tabs={[
          { label: "Challenges", href: "/challenges" },
          { label: "Manage", href: "/admin/challenges" },
        ]}
        active="/admin/challenges"
      />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">Weekly challenges</h1>
          <p className="text-foreground-secondary">Only one challenge is active for students at a time.</p>
        </div>
        <Link
          href="/admin/challenges/create"
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> New challenge
        </Link>
      </div>

      <ChallengeList
        initialChallenges={challenges.map((c) => ({ ...c, weekOf: c.weekOf.toISOString() }))}
      />
    </div>
  );
}
