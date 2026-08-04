import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";
import { CreateTrainingForm } from "@/components/admin/create-training-form";
import { SectionTabs } from "@/components/section-tabs";

export const metadata = { title: "Create a training · Technical Training" };

export default async function CreateTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/create-training");
  if (!canInstruct(session.user.role)) redirect("/dashboard");

  return (
    <div className="w-full mx-auto max-w-3xl px-4 py-12">
      <SectionTabs
        tabs={[
          { label: "Courses", href: "/courses" },
          { label: "Create", href: "/admin/create-training" },
        ]}
        active="/admin/create-training"
      />
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Create a training</h1>
      <p className="text-foreground-secondary mb-8">
        Have Claude draft a starting point from a topic, or write it yourself from scratch —
        either way you land in the same editor and nothing goes live until you publish it.
      </p>

      <CreateTrainingForm />
    </div>
  );
}
