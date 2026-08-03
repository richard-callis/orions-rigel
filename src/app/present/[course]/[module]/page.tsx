import { notFound } from "next/navigation";
import { getAnyCourse, getAnyModule } from "@/lib/content";
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
      slides={slides}
      title={mod.meta.title}
      courseTitle={course.title}
      exitHref={`/courses/${courseSlug}/${moduleSlug}`}
      courseSlug={courseSlug}
      moduleSlug={moduleSlug}
      isInstructor={isInstructor}
    />
  );
}
