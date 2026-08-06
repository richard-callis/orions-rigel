"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Radio,
  ArrowDownToLine,
  Hourglass,
  ArrowRight,
} from "lucide-react";
import { LiveQA } from "./live-qa";
import { LiveChat } from "./live-chat";

type LiveSessionState = {
  id: string;
  courseSlug: string;
  moduleSlug: string;
  currentSlide: number;
  isActive: boolean;
  instructorId: string;
  roomCode: string;
} | null;

export function SlideDeck({
  slides,
  title,
  courseTitle,
  exitHref,
  courseSlug,
  moduleSlug,
  isInstructor,
  nextModuleSlug,
  nextModuleTitle,
}: {
  slides: ReactNode[];
  title: string;
  courseTitle: string;
  exitHref: string;
  courseSlug: string;
  moduleSlug: string;
  isInstructor: boolean;
  nextModuleSlug: string | null;
  nextModuleTitle: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState<LiveSessionState>(null);
  const [pending, setPending] = useState(false);
  const [checkedLive, setCheckedLive] = useState(false);
  const total = slides.length;

  const { data: authSession } = useSession();
  const myId = authSession?.user?.id;

  const liveActive = live?.isActive ?? false;
  const liveId = live?.id ?? null;
  const liveSlide = live?.currentSlide ?? null;
  const ownedByMe = isInstructor && live?.instructorId === myId;

  // Non-instructors can't see any slide content until a session is live —
  // Present Mode is instructor-led, not a second copy of the self-study
  // page. Instructors always see the deck so they can prep/navigate before
  // going live.
  const waitingForInstructor = !isInstructor && checkedLive && !liveActive;

  // Once we know a session's roomCode (from either poll below), keep
  // polling it by room instead of by courseSlug+moduleSlug — a room code
  // is stable across the instructor advancing to the next module (see
  // /api/live-sessions/[id]/advance), while courseSlug+moduleSlug is not.
  // This is what lets viewers follow module-to-module without re-joining.
  // A real state (not just a ref) so losing the room — the session ended —
  // properly re-arms the module-scoped poll below to notice a *new*
  // session starting, instead of latching onto a dead room forever.
  const [roomCode, setRoomCode] = useState<string | null>(null);

  // Poll the module's live session. This is the entry-point poll — it's
  // how a viewer first discovers a session on the module they opened —
  // and it's what the instructor uses to resume/notice conflicts. Once a
  // roomCode is known, the room-scoped poll below takes over as the
  // source of truth and this one goes idle (except to keep instructor
  // conflict-detection accurate).
  useEffect(() => {
    let ignore = false;
    async function poll() {
      const res = await fetch(
        `/api/live-sessions?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}`
      );
      if (res.ok && !ignore) {
        const body = await res.json();
        if (!roomCode) {
          setLive(body.session);
          if (body.session?.roomCode) setRoomCode(body.session.roomCode);
        }
        setCheckedLive(true);
      }
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [courseSlug, moduleSlug, roomCode]);

  // Room-scoped poll: once we know the roomCode, this is authoritative.
  // For non-instructors, if the session's moduleSlug has moved on from
  // this page's moduleSlug (the instructor advanced), navigate to follow —
  // same room, no re-join, no new code. If the room goes dark (session
  // ended, no successor yet), clear roomCode so the module-scoped poll
  // above resumes looking for a *new* session instead of a viewer being
  // stuck on "waiting for the instructor" forever with no way to recover
  // short of a manual reload.
  const redirectedToRef = useRef<string | null>(null);
  useEffect(() => {
    if (!roomCode) return;

    let ignore = false;
    async function poll() {
      const res = await fetch(`/api/live-sessions/by-room?roomCode=${encodeURIComponent(roomCode!)}`);
      if (!res.ok || ignore) return;
      const body = await res.json();
      const session = body.session as LiveSessionState;
      if (!session) {
        setLive(null);
        setRoomCode(null);
        redirectedToRef.current = null;
        return;
      }
      if (!isInstructor && session.moduleSlug !== moduleSlug) {
        // Only fire the navigation once per destination — router.push not
        // completing yet (still on this poll tick) shouldn't cause a
        // second push to the same target every 2.5s.
        if (redirectedToRef.current !== session.moduleSlug) {
          redirectedToRef.current = session.moduleSlug;
          router.push(`/present/${session.courseSlug}/${session.moduleSlug}`);
        }
        return;
      }
      setLive(session);
    }
    poll();
    const interval = setInterval(poll, 2500);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [roomCode, isInstructor, moduleSlug, router]);

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

  // Report attendance progress as the student follows along, and mark the
  // module complete (with live-attendance credit) the moment they reach the
  // final slide while a session is live. This is what makes "went through
  // it live with the instructor" count as different from self-study.
  const reportedSlideRef = useRef(-1);
  const markedCompleteRef = useRef(false);
  useEffect(() => {
    if (isInstructor || !liveActive || !liveId || !myId) return;
    if (index <= reportedSlideRef.current) return;
    reportedSlideRef.current = index;

    fetch(`/api/live-sessions/${liveId}/attend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reachedSlide: index }),
    });

    if (index >= total - 1 && !markedCompleteRef.current) {
      markedCompleteRef.current = true;
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, moduleSlug, attendedLive: true }),
      });
    }
  }, [index, isInstructor, liveActive, liveId, myId, total, courseSlug, moduleSlug]);

  const effectiveMaxRef = useRef(effectiveMax);
  useEffect(() => {
    effectiveMaxRef.current = effectiveMax;
  }, [effectiveMax]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack Space/Arrow/Home/End while the user is typing
      // somewhere (e.g. the Q&A textarea) — those keys need to reach the
      // input instead of flipping slides.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

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

  // Instructor: roll the whole live session forward to the next module,
  // same room code, everyone currently following comes along automatically
  // (see the room-scoped poll above, and /api/live-sessions/[id]/advance).
  async function nextModule() {
    if (!liveId || !nextModuleSlug) return;
    setPending(true);
    try {
      const res = await fetch(`/api/live-sessions/${liveId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleSlug: nextModuleSlug }),
      });
      if (res.ok) {
        router.push(`/present/${courseSlug}/${nextModuleSlug}`);
      }
    } finally {
      setPending(false);
    }
  }

  // Not an instructor, and we've confirmed (not just defaulted-to-false)
  // that no session is live: don't render the deck at all.
  if (!isInstructor && !checkedLive) {
    return <div className="fixed inset-0 bg-background" />;
  }

  if (waitingForInstructor) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Hourglass size={28} className="text-muted" />
        <div className="text-center">
          <p className="text-lg font-medium">Waiting for the instructor to go live</p>
          <p className="mt-1 text-sm text-foreground-secondary">
            {courseTitle} · {title}
          </p>
        </div>
        <Link
          href={exitHref}
          className="mt-4 flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <X size={14} /> Exit
        </Link>
      </div>
    );
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

      <div className="flex items-center justify-end gap-4 px-6 py-3">
        {isInstructor && (
          <>
            {liveActive && ownedByMe ? (
              <>
                <span className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs">
                  <span className="text-muted">Room code</span>
                  <span className="font-mono font-semibold tracking-wider">{live?.roomCode}</span>
                </span>
                {nextModuleSlug && index >= total - 1 && (
                  <button
                    onClick={nextModule}
                    disabled={pending}
                    title={nextModuleTitle ?? undefined}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    Next module <ArrowRight size={12} />
                  </button>
                )}
                <button
                  onClick={endLive}
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-2.5 py-1 text-xs font-medium text-error hover:bg-error/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Radio size={12} className="animate-pulse" /> End session
                </button>
              </>
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
        <Link
          href={exitHref}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <X size={14} /> Exit
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-6 md:px-20">
        <div className="mx-auto max-w-4xl">{slides[index]}</div>
      </div>

      <LiveQA courseSlug={courseSlug} moduleSlug={moduleSlug} />
      {liveActive && liveId && <LiveChat liveSessionId={liveId} isInstructor={isInstructor} />}

      <div className="relative flex items-center justify-center gap-6 px-6 pb-6">
        <span className="eyebrow absolute left-6 hidden sm:inline">{courseTitle}</span>

        <button
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <span className="font-mono text-xs text-muted" title={title}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, effectiveMax))}
          disabled={index >= effectiveMax}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30 transition-colors cursor-pointer"
        >
          Next <ChevronRight size={16} />
        </button>

        <span className="eyebrow absolute right-6 hidden sm:inline">{title}</span>
      </div>
    </div>
  );
}
