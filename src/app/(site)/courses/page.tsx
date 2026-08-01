import Link from "next/link";
import { getCourses, getCourseModules } from "@/lib/content";

export const metadata = { title: "Courses · Technical Training" };

export default function CoursesPage() {
  const courses = getCourses();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">Courses</h1>
      <p className="text-foreground/60 mb-10">
        Hands-on courses with a live, in-browser database — run real queries as you learn.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const modules = getCourseModules(course.slug);
          return (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              className="rounded-lg border border-border p-5 hover:border-accent transition-colors"
            >
              <h2 className="font-semibold text-lg mb-1">{course.title}</h2>
              {course.tagline && (
                <p className="text-sm text-accent mb-2">{course.tagline}</p>
              )}
              <p className="text-sm text-foreground/60 mb-3">{course.description}</p>
              <p className="text-xs text-foreground/40">{modules.length} modules</p>
            </Link>
          );
        })}

        {courses.length === 0 && (
          <p className="text-foreground/50">No courses published yet.</p>
        )}
      </div>
    </div>
  );
}
