"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function SlideDeck({
  slides,
  title,
  exitHref,
}: {
  slides: ReactNode[];
  title: string;
  exitHref: string;
}) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(total - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <div className="h-1 w-full bg-white/10">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-3 text-sm text-white/50">
        <span>{title}</span>
        <div className="flex items-center gap-4">
          <span>
            {index + 1} / {total}
          </span>
          <Link href={exitHref} className="flex items-center gap-1 hover:text-white transition-colors">
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
          className="flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <button
          onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
          disabled={index === total - 1}
          className="flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 transition-colors cursor-pointer"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
