import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

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
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
        // request, not require them to sign out and back in. Falls back to
        // the token's role if the user was deleted since the token issued.
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        session.user.role = fresh?.role ?? (token.role as "STUDENT" | "INSTRUCTOR" | "ADMIN");
      }
      return session;
    },
  },
});
