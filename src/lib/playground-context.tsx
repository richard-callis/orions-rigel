"use client";

import { createContext, useContext } from "react";
import type { SandboxType } from "@/lib/content";

type PlaygroundContextValue = {
  kind: SandboxType;
  /** Send a snippet from the lesson straight into the live console (run SQL, or validate YAML). */
  runQuery: (text: string) => void;
};

export const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

/** Returns null outside of a Learn-view page (e.g. in Present mode) — callers should handle that. */
export function usePlayground() {
  return useContext(PlaygroundContext);
}
