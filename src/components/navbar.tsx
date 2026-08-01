"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-border bg-surface/60 backdrop-blur sticky top-0 z-40">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          Technical Training
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link href="/courses" className="hover:text-accent transition-colors">
            Courses
          </Link>

          {status === "authenticated" ? (
            <>
              <Link href="/dashboard" className="hover:text-accent transition-colors">
                Dashboard
              </Link>
              <span className="text-foreground/60 hidden sm:inline">
                {session.user?.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </>
          ) : status === "loading" ? (
            <span className="text-foreground/40">…</span>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-accent text-white px-3 py-1.5 hover:opacity-90 transition-opacity"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
