import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { lockAdminCount } from "@/lib/admin-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Bootstrap admin access: an address in ADMIN_EMAILS becomes ADMIN on signup
// (deploy-time, operator-controlled), and — so a fresh deployment always has
// *someone* who can assign roles — the very first account ever created also
// becomes ADMIN. Every signup after that defaults to STUDENT and roles are
// then assigned by an admin, not self-served.
//
// The "first account becomes ADMIN" check is a read-then-write on the total
// user count, so it must run under the same advisory lock used everywhere
// else the admin count is read-then-acted-on (see lib/admin-guard.ts) —
// otherwise two concurrent signups against a fresh deployment can both
// observe count === 0 and both become ADMIN.
async function roleFor(email: string, tx: Prisma.TransactionClient): Promise<Role> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes(email)) return Role.ADMIN;

  await lockAdminCount(tx);
  const userCount = await tx.user.count();
  return userCount === 0 ? Role.ADMIN : Role.STUDENT;
}

export async function POST(request: Request) {
  // Enforced before touching the DB or hashing anything, so mass fake-account creation (which
  // also amplifies the admin-bootstrap race window above) can't run unbounded.
  const ip = getClientIp(request);
  if (!checkRateLimit(`signup:${ip}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  // Hash outside the transaction — bcrypt is deliberately slow (~250ms at cost 12), and holding
  // the admin-count advisory lock for that long would serialize every concurrent signup on it.
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await db.$transaction(async (tx) => {
      const role = await roleFor(email, tx);
      return tx.user.create({
        data: { name, email, passwordHash, role },
        select: { id: true, name: true, email: true },
      });
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
