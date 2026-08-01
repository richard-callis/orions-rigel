"use client";

import { createContext, useContext, type ReactNode } from "react";

type LessonMeta = { courseSlug: string; moduleSlug: string };

const LessonMetaContext = createContext<LessonMeta | null>(null);

export function LessonMetaProvider({
  courseSlug,
  moduleSlug,
  children,
}: LessonMeta & { children: ReactNode }) {
  return (
    <LessonMetaContext.Provider value={{ courseSlug, moduleSlug }}>
      {children}
    </LessonMetaContext.Provider>
  );
}

export function useLessonMeta() {
  const ctx = useContext(LessonMetaContext);
  if (!ctx) {
    throw new Error("useLessonMeta must be used within a LessonMetaProvider");
  }
  return ctx;
}
