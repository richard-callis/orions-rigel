import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";
import { CreateChallengeForm } from "@/components/admin/create-challenge-form";
import { SectionTabs } from "@/components/section-tabs";

export const metadata = { title: "Create a challenge · Technical Training" };

export default async function CreateChallengePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/challenges/create");
  if (!canInstruct(session.user.role)) redirect("/dashboard");

  return (
    <div className="w-full mx-auto max-w-3xl px-4 py-12">
      <SectionTabs
        tabs={[
          { label: "Challenges", href: "/challenges" },
          { label: "Manage", href: "/admin/challenges" },
        ]}
        active="/admin/challenges"
      />
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Create a weekly challenge</h1>
      <p className="text-foreground-secondary mb-8">
        Have Claude draft a problem from a topic, or write it yourself — either way you review
        every field, including the reference solution, before publishing. Publishing doesn&apos;t
        activate it for students until you flip it on, here or from the challenge list.
      </p>

      <CreateChallengeForm />
    </div>
  );
}
