import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const COURSES_DIR = path.join(process.cwd(), "src", "content", "courses");

export type CourseMeta = {
  slug: string;
  title: string;
  description: string;
  tagline?: string;
};

export type ModuleLevel = "setup" | "foundations" | "intermediate" | "mastery" | "reference";

export type ModuleMeta = {
  slug: string;
  order: number;
  title: string;
  description: string;
  level: ModuleLevel;
  duration?: string;
};

export type ModuleContent = {
  meta: ModuleMeta;
  content: string;
};

/** Filenames look like `01-foundations.mdx` — split the sort prefix from the URL slug. */
function parseFileName(fileName: string): { order: number; slug: string } | null {
  const match = fileName.match(/^(\d+)-(.+)\.mdx$/);
  if (!match) return null;
  return { order: Number(match[1]), slug: match[2] };
}

export function getCourses(): CourseMeta[] {
  if (!fs.existsSync(COURSES_DIR)) return [];

  return fs
    .readdirSync(COURSES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => getCourse(entry.name))
    .filter((course): course is CourseMeta => course !== null);
}

export function getCourse(courseSlug: string): CourseMeta | null {
  const metaPath = path.join(COURSES_DIR, courseSlug, "course.json");
  if (!fs.existsSync(metaPath)) return null;

  const raw = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  return { slug: courseSlug, ...raw };
}

export function getCourseModules(courseSlug: string): ModuleMeta[] {
  const courseDir = path.join(COURSES_DIR, courseSlug);
  if (!fs.existsSync(courseDir)) return [];

  return fs
    .readdirSync(courseDir)
    .map((fileName): ModuleMeta | null => {
      const parsed = parseFileName(fileName);
      if (!parsed) return null;

      const raw = fs.readFileSync(path.join(courseDir, fileName), "utf-8");
      const { data } = matter(raw);

      return {
        slug: parsed.slug,
        order: parsed.order,
        title: data.title ?? parsed.slug,
        description: data.description ?? "",
        level: (data.level ?? "reference") as ModuleLevel,
        duration: data.duration,
      };
    })
    .filter((m): m is ModuleMeta => m !== null)
    .sort((a, b) => a.order - b.order);
}

export function getModule(courseSlug: string, moduleSlug: string): ModuleContent | null {
  const courseDir = path.join(COURSES_DIR, courseSlug);
  if (!fs.existsSync(courseDir)) return null;

  const fileName = fs
    .readdirSync(courseDir)
    .find((f) => parseFileName(f)?.slug === moduleSlug);
  if (!fileName) return null;

  const parsed = parseFileName(fileName)!;
  const raw = fs.readFileSync(path.join(courseDir, fileName), "utf-8");
  const { data, content } = matter(raw);

  return {
    meta: {
      slug: parsed.slug,
      order: parsed.order,
      title: data.title ?? parsed.slug,
      description: data.description ?? "",
      level: (data.level ?? "reference") as ModuleLevel,
      duration: data.duration,
    },
    content,
  };
}

/** Adjacent modules for prev/next navigation within a course. */
export function getModuleNeighbors(courseSlug: string, moduleSlug: string) {
  const modules = getCourseModules(courseSlug);
  const index = modules.findIndex((m) => m.slug === moduleSlug);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? modules[index - 1] : null,
    next: index < modules.length - 1 ? modules[index + 1] : null,
  };
}
