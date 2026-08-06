"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Pause, Play, X } from "lucide-react";
import { slideIndexAt, type SessionEvent } from "@/lib/session-events";
import { AttendancePanel, type AttendanceRow } from "./attendance-panel";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ReplayPlayer({
  slides,
  title,
  courseTitle,
  exitHref,
  events,
  durationMs,
  isActive,
  attendance,
}: {
  slides: ReactNode[];
  title: string;
  courseTitle: string;
  exitHref: string;
  events: SessionEvent[];
  durationMs: number;
  isActive: boolean;
  /** Instructor-only — undefined for non-instructor viewers, who see no attendance panel. */
  attendance?: AttendanceRow[];
}) {
  const total = slides.length;
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let frame: number;
    const tick = (now: number) => {
      const last = lastTickRef.current ?? now;
      lastTickRef.current = now;
      setCurrentMs((ms) => {
        const next = ms + (now - last);
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, durationMs]);

  const slideIndex = Math.min(slideIndexAt(events, currentMs), total - 1);

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <div className="h-1 w-full bg-border">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${((slideIndex + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-6 py-3">
        <span className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted">
          Replay{isActive && " · session still live"}
        </span>
        <Link
          href={exitHref}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <X size={14} /> Exit
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-10 py-6 md:px-20">
        <div className="mx-auto max-w-4xl">{slides[slideIndex]}</div>
      </div>

      {attendance && <AttendancePanel rows={attendance} totalSlides={total} />}

      <div className="px-6 pb-3">
        <input
          type="range"
          min={0}
          max={durationMs}
          value={currentMs}
          onChange={(e) => setCurrentMs(Number(e.target.value))}
          className="w-full accent-accent cursor-pointer"
          disabled={durationMs === 0}
        />
      </div>

      <div className="relative flex items-center justify-center gap-6 px-6 pb-6">
        <span className="eyebrow absolute left-6 hidden sm:inline">{courseTitle}</span>

        <button
          onClick={() => setPlaying((p) => !p)}
          disabled={durationMs === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30 transition-colors cursor-pointer"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          {playing ? "Pause" : "Play"}
        </button>
        <span className="font-mono text-xs text-muted" title={title}>
          {formatTime(currentMs)} / {formatTime(durationMs)}
        </span>

        <span className="eyebrow absolute right-6 hidden sm:inline">{title}</span>
      </div>
    </div>
  );
}
