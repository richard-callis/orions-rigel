import type { Role } from "@/generated/prisma/enums";

/** Admins have every instructor capability, plus user management. */
export function canInstruct(role: Role | undefined | null): boolean {
  return role === "INSTRUCTOR" || role === "ADMIN";
}
