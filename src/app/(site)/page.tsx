import Link from "next/link";
import { Database, Presentation, GraduationCap } from "lucide-react";
import { getCourses, getCourseModules } from "@/lib/content";

export default function Home() {
  const courses = getCourses();

  return (
    <div className="flex-1">
      <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
          Learn by running real queries
        </h1>
        <p className="text-lg text-foreground-secondary max-w-2xl mx-auto mb-8">
          Hands-on technical courses with a live database in your browser. Follow along,
          write your own code, and track your progress — or pull the same lesson up as a
          full-screen presentation while you teach.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/courses"
            className="rounded-lg bg-accent text-accent-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Browse courses
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface-raised transition-colors"
          >
            Create an account
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature
            icon={<Database size={18} />}
            title="Live in-browser database"
            body="Every lesson ships with a real, isolated Postgres instance running in your tab — no signup, no shared server, nothing to break for anyone else."
          />
          <Feature
            icon={<GraduationCap size={18} />}
            title="Track your progress"
            body="Sign up to mark modules complete and pick up right where you left off across every course."
          />
          <Feature
            icon={<Presentation size={18} />}
            title="Built for teaching"
            body="Every lesson doubles as a full-screen slide deck — the same source, no separate slides to maintain."
          />
        </div>
      </section>

      {courses.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-24">
          <p className="eyebrow mb-3">Courses</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => {
              const modules = getCourseModules(course.slug);
              return (
                <Link
                  key={course.slug}
                  href={`/courses/${course.slug}`}
                  className="rounded-xl border border-border bg-surface p-5 hover:border-accent transition-colors"
                >
                  <h3 className="font-semibold text-lg mb-1">{course.title}</h3>
                  {course.tagline && <p className="text-sm text-accent mb-2">{course.tagline}</p>}
                  <p className="text-sm text-foreground-secondary mb-3">{course.description}</p>
                  <p className="text-xs text-muted">{modules.length} modules</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-accent mb-2">{icon}</div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-foreground-secondary">{body}</p>
    </div>
  );
}
