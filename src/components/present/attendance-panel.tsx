"use client";

import { useState } from "react";
import { ChevronUp, Users } from "lucide-react";

export type AttendanceRow = {
  name: string;
  joinedAt: string;
  reachedSlide: number;
};

// Instructor-only panel on the session replay page — who actually attended
// this live session and how far they got, distinct from the aggregate
// "N watching" viewer count shown during the session itself.
export function AttendancePanel({ rows, totalSlides }: { rows: AttendanceRow[]; totalSlides: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const finishedCount = rows.filter((r) => r.reachedSlide >= totalSlides - 1).length;

  return (
    <div className="fixed bottom-6 left-6 w-72 flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex items-center justify-between rounded-lg bg-surface-raised border border-border px-3 py-2 text-xs font-medium hover:bg-surface transition-colors"
      >
        <span className="flex items-center gap-2">
          <Users size={14} /> Attendance ({rows.length})
        </span>
        <ChevronUp size={14} className={`transition-transform ${isOpen ? "" : "rotate-180"}`} />
      </button>

      {isOpen && (
        <div className="rounded-lg border border-border bg-surface flex flex-col max-h-72">
          <div className="border-b border-border px-3 py-2 text-xs text-muted">
            {finishedCount} / {rows.length} reached the last slide
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {rows.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Nobody attended this session</p>
            ) : (
              rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-surface-raised"
                >
                  <span>{r.name}</span>
                  <span
                    className={`font-mono ${
                      r.reachedSlide >= totalSlides - 1 ? "text-success" : "text-muted"
                    }`}
                  >
                    {r.reachedSlide + 1}/{totalSlides}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
