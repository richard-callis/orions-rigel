import Link from "next/link";
import { Radio, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getAnyCourse, getAnyModule } from "@/lib/content";

export const metadata = { title: "Live · Technical Training" };

const PRESENCE_WINDOW_MS = 30_000;

export default async function LivePage() {
  const sessions = await db.liveSession.findMany({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
  });

  const since = new Date();
  since.setMilliseconds(since.getMilliseconds() - PRESENCE_WINDOW_MS);
  const cards = await Promise.all(
    sessions.map(async (s) => {
      const [course, mod, instructor, viewerCount] = await Promise.all([
        getAnyCourse(s.courseSlug),
        getAnyModule(s.courseSlug, s.moduleSlug),
        db.user.findUnique({ where: { id: s.instructorId }, select: { name: true } }),
        db.liveSessionAttendance.count({
          where: { liveSessionId: s.id, lastSeenAt: { gte: since } },
        }),
      ]);
      return { session: s, course, mod, instructor, viewerCount };
    })
  );

  return (
    <div className="w-full mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Radio size={22} className="text-error" />
        <h1 className="text-3xl font-semibold tracking-tight">Live now</h1>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-foreground-secondary">
          No one is live right now. Check back later, or an instructor can go live from any
          module&apos;s Present Mode.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ session, course, mod, instructor, viewerCount }) => {
            if (!course || !mod) return null;
            return (
              <Link
                key={session.id}
                href={`/present/${session.courseSlug}/${session.moduleSlug}`}
                className="rounded-xl border border-error/30 bg-error/5 p-5 hover:border-error/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex items-center gap-1 rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">
                    <Radio size={10} /> LIVE
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Users size={12} /> {viewerCount} watching
                  </span>
                </div>
                <h2 className="font-semibold text-lg mb-1">{mod.meta.title}</h2>
                <p className="text-sm text-foreground-secondary mb-3">{course.title}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    Hosted by {instructor?.name ?? "an instructor"}
                  </span>
                  <span className="font-mono font-semibold tracking-wider text-foreground">
                    {session.roomCode}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
