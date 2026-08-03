"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
      <nav className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Technical Training
        </Link>

        <div className="flex items-center gap-4 text-sm text-foreground-secondary">
          <Link href="/courses" className="hover:text-accent transition-colors">
            Courses
          </Link>

          {status === "authenticated" ? (
            <>
              <Link href="/dashboard" className="hover:text-accent transition-colors">
                Dashboard
              </Link>
              <Link href="/review" className="hover:text-accent transition-colors">
                Review
              </Link>
              {session.user?.role === "ADMIN" && (
                <Link href="/admin/users" className="hover:text-accent transition-colors">
                  Admin
                </Link>
              )}
              <span className="text-muted hidden sm:inline">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-raised transition-colors cursor-pointer"
              >
                Sign out
              </button>
            </>
          ) : status === "loading" ? (
            <span className="text-muted">…</span>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 font-medium hover:opacity-90 transition-opacity"
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
