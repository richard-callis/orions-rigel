"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { JoinRoom } from "@/components/join-room";

export function Navbar() {
  const { data: session, status } = useSession();
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let ignore = false;
    async function poll() {
      const res = await fetch("/api/live-sessions");
      if (res.ok && !ignore) {
        const body = await res.json();
        setLiveCount((body.sessions ?? []).length);
      }
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [status]);

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
          <Link href="/challenges" className="hover:text-accent transition-colors">
            Challenges
          </Link>
          <Link href="/live" className="flex items-center gap-1.5 hover:text-error transition-colors">
            Live
            {liveCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-error px-1 text-[10px] font-bold text-white">
                {liveCount}
              </span>
            )}
          </Link>

          {status === "authenticated" ? (
            <>
              <JoinRoom />
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
              <Link href="/account" className="text-muted hidden sm:inline hover:text-accent transition-colors">
                {session.user?.name}
              </Link>
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
