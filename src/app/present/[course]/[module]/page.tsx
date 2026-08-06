import { notFound } from "next/navigation";
import { getAnyCourse, getAnyModule, getAnyModuleNeighbors } from "@/lib/content";
import { splitIntoSlides } from "@/lib/slides";
import { Lesson } from "@/components/mdx/lesson";
import { SlideDeck } from "@/components/present/slide-deck";
import { auth } from "@/lib/auth";
import { canInstruct } from "@/lib/roles";

type Props = {
  params: Promise<{ course: string; module: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;
  const mod = await getAnyModule(courseSlug, moduleSlug);
  return { title: mod ? `Present · ${mod.meta.title}` : "Not found" };
}

export default async function PresentPage({ params }: Props) {
  const { course: courseSlug, module: moduleSlug } = await params;

  const course = await getAnyCourse(courseSlug);
  const mod = await getAnyModule(courseSlug, moduleSlug);
  if (!course || !mod) notFound();

  const session = await auth();
  const isInstructor = canInstruct(session?.user?.role);
  const { next: nextModule } = await getAnyModuleNeighbors(courseSlug, moduleSlug);

  const chunks = splitIntoSlides(mod.content);
  const slideProse = "prose prose-invert prose-lg md:prose-xl max-w-none prose-headings:font-semibold";
  const slides = chunks.map((chunk, i) => (
    <Lesson
      key={i}
      content={chunk}
      proseClassName={slideProse}
      courseSlug={courseSlug}
      moduleSlug={moduleSlug}
      trusted={mod.trusted}
    />
  ));

  return (
    <SlideDeck
      // Force a full remount on module change — this page is reached both
      // by normal navigation and by a live-session module handoff (see
      // slide-deck.tsx's room-scoped poll), and per-module local state
      // (current slide index, "have I reported attendance yet" refs) must
      // not carry over from the previous module in either case.
      key={moduleSlug}
      slides={slides}
      title={mod.meta.title}
      courseTitle={course.title}
      exitHref={`/courses/${courseSlug}/${moduleSlug}`}
      courseSlug={courseSlug}
      moduleSlug={moduleSlug}
      isInstructor={isInstructor}
      nextModuleSlug={nextModule?.slug ?? null}
      nextModuleTitle={nextModule?.title ?? null}
    />
  );
}
