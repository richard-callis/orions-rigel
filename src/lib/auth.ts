import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// A hash of a value nobody will ever type, used to keep authorize()'s timing shape identical
// on the "no such user" path — see the comment at its call site below.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8u1yAaTz1AhBhCk8V9zN7YbfxJlPAy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        // Enforced before the DB lookup / bcrypt.compare so repeated failed attempts don't get
        // to spend a bcrypt call's worth of CPU each time.
        const ip = getClientIp(request);
        if (!checkRateLimit(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
          return null;
        }

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        // Run a dummy bcrypt.compare even when the user doesn't exist, so "no such user" and
        // "wrong password" take the same amount of time — otherwise the early return here is a
        // timing oracle an attacker can use to enumerate valid emails.
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Re-read the role from the DB on every session check rather than
        // trusting the JWT's cached value — an admin assigning a role
        // change to another user should take effect on that user's next
        // request, not require them to sign out and back in.
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        // Fail closed, not open: if the user row is gone (account deleted)
        // since the token was issued, don't fall back to the JWT's cached
        // role — that would let a deleted admin retain admin access for up
        // to the token's full lifetime.
        session.user.role = fresh?.role ?? "STUDENT";
      }
      return session;
    },
  },
});
