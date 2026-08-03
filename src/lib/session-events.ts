export type SessionEvent = { slideIndex: number; atMs: number };

// LiveSession.sessionEvents is a Prisma Json column — narrow it defensively
// rather than trusting the stored shape.
export function parseSessionEvents(value: unknown): SessionEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (e): e is SessionEvent =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as SessionEvent).slideIndex === "number" &&
      typeof (e as SessionEvent).atMs === "number"
  );
}

// The slide that was on screen at a given point in the replay timeline.
export function slideIndexAt(events: SessionEvent[], atMs: number): number {
  let current = events[0]?.slideIndex ?? 0;
  for (const event of events) {
    if (event.atMs > atMs) break;
    current = event.slideIndex;
  }
  return current;
}
