import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";

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
async function roleFor(email: string): Promise<Role> {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.includes(email)) return Role.ADMIN;

  const userCount = await db.user.count();
  return userCount === 0 ? Role.ADMIN : Role.STUDENT;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const role = await roleFor(email);

  try {
    const user = await db.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true },
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
