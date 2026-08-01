"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { PlaygroundContext } from "@/lib/playground-context";
import { SqlConsole, type SqlConsoleHandle } from "./sql-console";

export function LearnLayout({
  children,
  courseSlug,
}: {
  children: ReactNode;
  courseSlug: string;
}) {
  const consoleRef = useRef<SqlConsoleHandle>(null);

  const contextValue = useMemo(
    () => ({
      runQuery: (sqlText: string) => consoleRef.current?.runQuery(sqlText),
    }),
    []
  );

  return (
    <PlaygroundContext.Provider value={contextValue}>
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 lg:h-[calc(100vh-3.5rem)]">
        <div className="overflow-y-auto px-6 py-8 lg:border-r border-border">
          <div className="w-full mx-auto max-w-2xl">{children}</div>
        </div>
        <div className="lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] border-t lg:border-t-0 border-border bg-surface">
          <SqlConsole ref={consoleRef} courseSlug={courseSlug} />
        </div>
      </div>
    </PlaygroundContext.Provider>
  );
}
