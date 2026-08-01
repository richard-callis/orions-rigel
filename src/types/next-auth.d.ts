import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "STUDENT" | "INSTRUCTOR";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "STUDENT" | "INSTRUCTOR";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "STUDENT" | "INSTRUCTOR";
  }
}
