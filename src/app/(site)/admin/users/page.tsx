import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRoleTable } from "@/components/admin/user-role-table";

export const metadata = { title: "Manage users · Technical Training" };

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/users");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return (
    <div className="w-full mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-1">Manage users</h1>
      <p className="text-foreground-secondary mb-8">
        Assign instructor and admin access. New signups start as students.
      </p>

      <UserRoleTable initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />
    </div>
  );
}
