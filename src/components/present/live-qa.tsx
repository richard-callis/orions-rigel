"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronUp, Send, ThumbsUp } from "lucide-react";

type Question = {
  id: string;
  text: string;
  answered: boolean;
  createdAt: Date;
  upvoteCount: number;
  hasUserUpvoted: boolean;
};

export function LiveQA({
  courseSlug,
  moduleSlug,
}: {
  courseSlug: string;
  moduleSlug: string;
}) {
  const { data: authSession } = useSession();
  const isInstructor = authSession?.user?.role === "INSTRUCTOR";

  const [isOpen, setIsOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Poll for questions
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function poll() {
      const res = await fetch(
        `/api/questions?courseSlug=${encodeURIComponent(courseSlug)}&moduleSlug=${encodeURIComponent(moduleSlug)}`
      );
      if (res.ok && !ignore) {
        const body = await res.json();
        setQuestions(body.questions);
      }
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [isOpen, courseSlug, moduleSlug]);

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseSlug, moduleSlug, text: newQuestionText }),
      });
      if (res.ok) {
        const newQuestion = await res.json();
        setQuestions((prev) => [newQuestion, ...prev]);
        setNewQuestionText("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUpvote(questionId: string) {
    setPending(true);
    try {
      const res = await fetch("/api/questions/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? updated : q))
        );
      }
    } finally {
      setPending(false);
    }
  }

  async function markAnswered(questionId: string, answered: boolean) {
    setPending(true);
    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answered }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? updated : q))
        );
      }
    } finally {
      setPending(false);
    }
  }

  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <div className="fixed bottom-6 right-6 w-80 flex flex-col">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity"
      >
        <span className="flex items-center gap-2">
          Q&A
          {unansweredCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-error text-accent-foreground text-xs font-bold">
              {unansweredCount}
            </span>
          )}
        </span>
        <ChevronUp
          size={14}
          className={`transition-transform ${isOpen ? "" : "rotate-180"}`}
        />
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="rounded-lg border border-border bg-surface flex flex-col h-96">
          {/* Question input */}
          {authSession?.user ? (
            <form
              onSubmit={submitQuestion}
              className="border-b border-border p-3 space-y-2"
            >
              <textarea
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Ask a question..."
                maxLength={500}
                disabled={submitting}
                className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 resize-none"
                rows={2}
              />
              <button
                type="submit"
                disabled={!newQuestionText.trim() || submitting}
                className="w-full flex items-center justify-center gap-1 rounded bg-accent px-2 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Send size={12} /> Ask
              </button>
            </form>
          ) : (
            <div className="border-b border-border p-3 text-xs text-muted">
              Sign in to ask a question
            </div>
          )}

          {/* Questions list */}
          <div className="flex-1 overflow-y-auto space-y-2 p-3">
            {questions.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">
                No questions yet
              </p>
            ) : (
              questions.map((q) => (
                <div
                  key={q.id}
                  className={`rounded border p-2 space-y-1.5 transition-opacity ${
                    q.answered
                      ? "border-border/50 bg-surface-raised/50 opacity-60"
                      : "border-border bg-surface-raised"
                  }`}
                >
                  <p className="text-xs leading-tight">{q.text}</p>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => toggleUpvote(q.id)}
                      disabled={pending || !authSession?.user}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                        q.hasUserUpvoted
                          ? "bg-accent/20 text-accent hover:bg-accent/30"
                          : "text-muted hover:bg-surface transition-colors"
                      }`}
                    >
                      <ThumbsUp size={10} /> {q.upvoteCount}
                    </button>
                    {isInstructor && (
                      <button
                        onClick={() => markAnswered(q.id, !q.answered)}
                        disabled={pending}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                          q.answered
                            ? "bg-success/20 text-success hover:bg-success/30"
                            : "text-muted hover:bg-surface"
                        }`}
                      >
                        {q.answered ? "Answered" : "Mark answered"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
