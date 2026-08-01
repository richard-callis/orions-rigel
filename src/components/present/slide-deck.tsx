"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, X, Radio, ArrowDownToLine } from "lucide-react";

type LiveSessionState = {
  id: string;
  currentSlide: number;
  isActive: boolean;
  instructorId: string;
} | null;

export function SlideDeck({
  slides,
  title,
  exitHref,
  courseSlug,
  moduleSlug,
  isInstructor,
}: {
  slides: ReactNode[];
  title: string;
  exitHref: string;
  courseSlug: string;
  moduleSlug: string;
  isInstructor: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState<LiveSessionState>(null);
  const [pending, setPending] = useState(false);
  const total = slides.length;

  const { data: authSession } = useSession();
  const myId = authSession?.user?.id;

  const liveActive = live?.isActive ?? false;
  const liveId = live?.id ?? null;
  const liveSlide = live?.currentSlide ?? null;
  const ownedByMe = isInstructor && live?.instructorId === myId;

  // Poll the module's live session — instructors need to resume/notice
  // conflicts, everyone else needs it to cap forward navigation.
  useEffect(() => {
    let ignore = false;
    async function poll() {
      const res = await fetch(
        `/api/live-sessions?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}`
      );
      if (res.ok && !ignore) {
        const body = await res.json();
        setLive(body.session);
      }
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [courseSlug, moduleSlug]);

  // Instructor: push local slide changes up as the source of truth.
  useEffect(() => {
    if (!isInstructor || !ownedByMe || !liveActive || !liveId) return;
    fetch(`/api/live-sessions/${liveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentSlide: index }),
    });
  }, [index, isInstructor, ownedByMe, liveActive, liveId]);

  // Non-instructor: never let local index get ahead of the instructor's
  // slide. If they were sitting at the frontier (not reviewing backward),
  // follow the instructor forward automatically.
  const prevLiveSlideRef = useRef<number | null>(null);
  useEffect(() => {
    if (isInstructor || !liveActive || liveSlide === null) return;
    // Capture the previous value as a plain const — the functional setIndex
    // updater below runs asynchronously, after the ref has already been
    // reassigned, so reading prevLiveSlideRef.current *inside* the updater
    // would see the new value instead of the old one.
    const prevSlide = prevLiveSlideRef.current;
    prevLiveSlideRef.current = liveSlide;
    setIndex((cur) => {
      if (cur > liveSlide) return liveSlide;
      if (prevSlide !== null && cur === prevSlide && cur < liveSlide) {
        return liveSlide;
      }
      return cur;
    });
  }, [liveSlide, liveActive, isInstructor]);

  const effectiveMax =
    !isInstructor && liveActive && liveSlide !== null ? Math.min(liveSlide, total - 1) : total - 1;

  const effectiveMaxRef = useRef(effectiveMax);
  useEffect(() => {
    effectiveMaxRef.current = effectiveMax;
  }, [effectiveMax]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const max = effectiveMaxRef.current;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, max));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(max);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function goLive() {
    setPending(true);
    try {
      const res = await fetch("/api/live-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, moduleSlug }),
      });
      if (res.ok) {
        const body = await res.json();
        setLive(body.session);
        setIndex(body.session.currentSlide);
      }
    } finally {
      setPending(false);
    }
  }

  async function endLive() {
    if (!liveId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/live-sessions/${liveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        const body = await res.json();
        setLive(body.session);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <div className="h-1 w-full bg-border">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {!isInstructor && liveActive && (
        <div className="flex items-center justify-center gap-2 border-b border-error/20 bg-error/10 py-1.5 text-xs text-error">
          <Radio size={12} className="animate-pulse" />
          Live — instructor is on slide {String((liveSlide ?? 0) + 1).padStart(2, "0")}
          {liveSlide !== null && index < liveSlide && (
            <button
              onClick={() => setIndex(liveSlide)}
              className="ml-1 flex items-center gap-1 rounded border border-error/30 px-2 py-0.5 hover:bg-error/20 transition-colors cursor-pointer"
            >
              <ArrowDownToLine size={10} /> Jump to live
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-6 py-3">
        <span className="eyebrow">{title}</span>
        <div className="flex items-center gap-4">
          {isInstructor && (
            <>
              {liveActive && ownedByMe ? (
                <button
                  onClick={endLive}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Radio size={12} className="animate-pulse" /> End session
                </button>
              ) : (
                <>
                  {liveActive && !ownedByMe && (
                    <span className="text-xs text-muted">Another instructor is live here</span>
                  )}
                  <button
                    onClick={goLive}
                    disabled={pending}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    <Radio size={12} /> {liveActive && !ownedByMe ? "Take over" : "Go live"}
                  </button>
                </>
              )}
            </>
          )}
          <span className="font-mono text-xs text-muted">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <Link
            href={exitHref}
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
          >
            <X size={14} /> Exit
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-6 md:px-20">
        <div className="mx-auto max-w-4xl">{slides[index]}</div>
      </div>

      <div className="flex items-center justify-center gap-6 pb-6">
        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, effectiveMax))}
          disabled={index >= effectiveMax}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30 transition-colors cursor-pointer"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
