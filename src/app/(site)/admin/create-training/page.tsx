import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";
import { CreateTrainingForm } from "@/components/admin/create-training-form";

export const metadata = { title: "Create a training · Technical Training" };

export default async function CreateTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/create-training");
  if (!canInstruct(session.user.role)) redirect("/dashboard");

  return (
    <div className="w-full mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Create a training</h1>
      <p className="text-foreground-secondary mb-8">
        Describe a topic, review what Claude drafts, edit anything you want, then publish.
        Nothing goes live until you publish it.
      </p>

      <CreateTrainingForm />
    </div>
  );
}
