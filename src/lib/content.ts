import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { db } from "@/lib/db";

const COURSES_DIR = path.join(process.cwd(), "src", "content", "courses");

export type SandboxType = "sql" | "yaml";

export type CourseMeta = {
  slug: string;
  title: string;
  description: string;
  tagline?: string;
  /** Which practice console Learn view mounts for this course. Defaults to "sql". */
  sandboxType?: SandboxType;
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

// ---------------------------------------------------------------------
// AI-generated courses (DB-backed, see /admin/create-training) — merged
// with the file-based courses above so every page that lists or renders a
// course sees both sources transparently. The file-based functions above
// are untouched; these are additive async wrappers used only where a page
// needs to see generated content too (the course catalog, a course
// overview, a module's Learn/Present view).
// ---------------------------------------------------------------------

function generatedCourseToMeta(course: {
  slug: string;
  title: string;
  description: string;
  tagline: string | null;
  sandboxType: string;
}): CourseMeta {
  return {
    slug: course.slug,
    title: course.title,
    description: course.description,
    tagline: course.tagline ?? undefined,
    sandboxType: course.sandboxType as SandboxType,
  };
}

function generatedModuleToMeta(mod: {
  slug: string;
  order: number;
  title: string;
  description: string;
  level: string;
  duration: string | null;
}): ModuleMeta {
  return {
    slug: mod.slug,
    order: mod.order,
    title: mod.title,
    description: mod.description,
    level: mod.level as ModuleLevel,
    duration: mod.duration ?? undefined,
  };
}

/** All courses, file-based and AI-generated. */
export async function getAllCourses(): Promise<CourseMeta[]> {
  const generated = await db.generatedCourse.findMany({ orderBy: { createdAt: "asc" } });
  return [...getCourses(), ...generated.map(generatedCourseToMeta)];
}

/** A single course by slug, checking file-based courses first. */
export async function getAnyCourse(courseSlug: string): Promise<CourseMeta | null> {
  const fileCourse = getCourse(courseSlug);
  if (fileCourse) return fileCourse;

  const generated = await db.generatedCourse.findUnique({ where: { slug: courseSlug } });
  return generated ? generatedCourseToMeta(generated) : null;
}

export async function getAnyCourseModules(courseSlug: string): Promise<ModuleMeta[]> {
  if (getCourse(courseSlug)) return getCourseModules(courseSlug);

  const generated = await db.generatedCourse.findUnique({
    where: { slug: courseSlug },
    include: { modules: { orderBy: { order: "asc" } } },
  });
  return generated ? generated.modules.map(generatedModuleToMeta) : [];
}

export async function getAnyModule(
  courseSlug: string,
  moduleSlug: string
): Promise<ModuleContent | null> {
  if (getCourse(courseSlug)) return getModule(courseSlug, moduleSlug);

  const generated = await db.generatedModule.findFirst({
    where: { slug: moduleSlug, course: { slug: courseSlug } },
  });
  return generated ? { meta: generatedModuleToMeta(generated), content: generated.content } : null;
}

export async function getAnyModuleNeighbors(courseSlug: string, moduleSlug: string) {
  const modules = await getAnyCourseModules(courseSlug);
  const index = modules.findIndex((m) => m.slug === moduleSlug);
  if (index === -1) return { prev: null, next: null };

  return {
    prev: index > 0 ? modules[index - 1] : null,
    next: index < modules.length - 1 ? modules[index + 1] : null,
  };
}

/** True if this slug is already taken by a file-based OR generated course. */
export async function courseSlugExists(courseSlug: string): Promise<boolean> {
  return (await getAnyCourse(courseSlug)) !== null;
}
