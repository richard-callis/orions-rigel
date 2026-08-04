import Link from "next/link";

// A plain server component, not usePathname()-driven — each page passes its
// own href as `active` rather than this component detecting the route
// itself, so it stays server-renderable and doesn't need "use client" (this
// app's pages are server components by default; adding a client boundary
// just for tab highlighting isn't worth it).
export function SectionTabs({
  tabs,
  active,
}: {
  tabs: { label: string; href: string }[];
  active: string;
}) {
  // Nothing to switch between for a student/anonymous visitor — don't show
  // an underlined single-tab bar just for one link.
  if (tabs.length < 2) return null;

  return (
    <div className="flex items-center gap-1 mb-8 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            tab.href === active
              ? "border-accent text-foreground font-medium"
              : "border-transparent text-foreground-secondary hover:text-foreground hover:border-border"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
