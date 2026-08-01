"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { SavedSnippet } from "@/components/playground/saved-snippets";

export function useSavedSnippets(courseSlug: string) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [items, setItems] = useState<SavedSnippet[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    let ignore = false;

    fetch(`/api/saved-queries?courseSlug=${encodeURIComponent(courseSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!ignore && body) setItems(body.queries);
      });

    return () => {
      ignore = true;
    };
  }, [signedIn, courseSlug]);

  async function save(title: string, content: string) {
    const res = await fetch("/api/saved-queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug, title, content }),
    });
    if (res.ok) {
      const body = await res.json();
      setItems((qs) => [body.query, ...qs]);
    }
  }

  async function remove(id: string) {
    setItems((qs) => qs.filter((q) => q.id !== id));
    await fetch(`/api/saved-queries/${id}`, { method: "DELETE" });
  }

  return { signedIn, items, save, remove };
}
