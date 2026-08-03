import { Prisma } from "@/generated/prisma/client";

// Arbitrary fixed key for a Postgres session-level advisory lock (scoped to
// the current transaction via pg_advisory_xact_lock — released automatically
// on commit/rollback). Anything that can change how many ADMIN users exist
// (role changes, self-deletion) must take this lock before counting admins,
// so two concurrent requests can't both observe "more than one admin left"
// and both proceed, leaving zero.
const ADMIN_COUNT_LOCK_KEY = 913_820_441;

export async function lockAdminCount(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_COUNT_LOCK_KEY})`;
}
