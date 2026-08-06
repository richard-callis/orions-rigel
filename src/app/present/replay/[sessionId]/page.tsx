import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCourse, getModule } from "@/lib/content";
import { splitIntoSlides } from "@/lib/slides";
import { Lesson } from "@/components/mdx/lesson";
import { ReplayPlayer } from "@/components/present/replay-player";
import { parseSessionEvents } from "@/lib/session-events";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { sessionId } = await params;
  const session = await db.liveSession.findUnique({ where: { id: sessionId } });
  return { title: session ? "Session replay" : "Not found" };
}

export default async function ReplayPage({ params }: Props) {
  const { sessionId } = await params;

  const session = await db.liveSession.findUnique({ where: { id: sessionId } });
  if (!session) notFound();

  const course = getCourse(session.courseSlug);
  const mod = getModule(session.courseSlug, session.moduleSlug);
  if (!course || !mod) notFound();

  const viewerSession = await auth();
  const isInstructor = canInstruct(viewerSession?.user?.role);
  const attendance = isInstructor
    ? await db.liveSessionAttendance.findMany({
        where: { liveSessionId: sessionId },
        select: { user: { select: { name: true } }, joinedAt: true, reachedSlide: true },
        orderBy: { joinedAt: "asc" },
      })
    : [];

  const chunks = splitIntoSlides(mod.content);
  const slideProse = "prose prose-invert prose-lg md:prose-xl max-w-none prose-headings:font-semibold";
  const slides = chunks.map((chunk, i) => (
    <Lesson
      key={i}
      content={chunk}
      proseClassName={slideProse}
      courseSlug={session.courseSlug}
      moduleSlug={session.moduleSlug}
    />
  ));

  const events = parseSessionEvents(session.sessionEvents);
  const durationMs = session.endedAt
    ? session.endedAt.getTime() - session.startedAt.getTime()
    : (events.at(-1)?.atMs ?? 0);

  return (
    <ReplayPlayer
      slides={slides}
      title={mod.meta.title}
      courseTitle={course.title}
      exitHref={`/courses/${session.courseSlug}/${session.moduleSlug}`}
      events={events}
      durationMs={durationMs}
      isActive={session.isActive}
      attendance={
        isInstructor
          ? attendance.map((a) => ({
              name: a.user.name,
              joinedAt: a.joinedAt.toISOString(),
              reachedSlide: a.reachedSlide,
            }))
          : undefined
      }
    />
  );
}
