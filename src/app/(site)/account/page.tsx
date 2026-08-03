import { auth } from "@/lib/auth";
import { DeleteAccount } from "@/components/account/delete-account";

export const metadata = { title: "Account · Technical Training" };

export default async function AccountPage() {
  const session = await auth();
  // proxy.ts already gates this route, but keep the page safe if hit directly in dev.
  if (!session?.user) return null;

  return (
    <div className="w-full mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Account</h1>
      <p className="text-foreground-secondary mb-8">{session.user.name} · {session.user.email}</p>

      <DeleteAccount />
    </div>
  );
}
