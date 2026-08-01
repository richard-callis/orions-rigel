"use client";

import { createContext, useContext } from "react";

type PlaygroundContextValue = {
  /** Send a snippet from the lesson straight into the live SQL console. */
  runQuery: (sql: string) => void;
};

export const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

/** Returns null outside of a Learn-view page (e.g. in Present mode) — callers should handle that. */
export function usePlayground() {
  return useContext(PlaygroundContext);
}
