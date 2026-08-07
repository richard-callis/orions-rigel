// In-memory sliding-window rate limiter. There's no Redis (or any shared cache) in this stack, so
// this is per-process state: on the single-instance docker-compose deployment it's a real control;
// on the multi-replica Kubernetes deployment README.md describes, each pod tracks its own counts
// independently, so the effective limit is (per-pod limit) x (replica count). Still worth having —
// it stops trivial single-process credential stuffing / signup spam — but don't treat it as a hard
// guarantee under k8s without a shared store.
//
// This is a throttle, not a lockout: it caps the rate of attempts against a key, it never bans a
// key outright. A rate limit keyed by a known identifier (e.g. an email) that blocks indefinitely
// would let an attacker deny service to that specific account just by making it fail repeatedly.

interface Entry {
  timestamps: number[]
}

const buckets = new Map<string, Entry>()

// Bound total memory: without this, an unauthenticated endpoint keyed by an attacker-controlled
// value (IP, email) is itself a memory-exhaustion vector.
const MAX_TRACKED_KEYS = 10_000

// Writes `key`'s entry and moves it to the end of the Map's iteration order (delete-then-set,
// since Map preserves a key's original position across a plain `set` on an existing key). Must be
// used on EVERY write, including the "blocked" path — a key that's actively being hammered is by
// definition the most recently used one, and if only the "allowed" path bumped position, an
// attacker hammering a single key past the limit would sink it toward the front of the eviction
// order and get their own count wiped by the `buckets.size > MAX_TRACKED_KEYS` eviction below,
// resetting their limit rather than the intended opposite (idle keys evicted first).
function touch(key: string, entry: Entry) {
  buckets.delete(key)
  buckets.set(key, entry)

  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value
    if (oldestKey !== undefined) buckets.delete(oldestKey)
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  const recent = entry ? entry.timestamps.filter((t) => now - t < windowMs) : []

  if (recent.length >= limit) {
    touch(key, { timestamps: recent })
    return false
  }

  recent.push(now)
  touch(key, { timestamps: recent })
  return true
}

// Best-effort client IP from proxy headers. Note: AUTH_TRUST_HOST is set with no trusted-proxy
// allowlist, so X-Forwarded-For is attacker-controlled when the app is reachable directly (not
// exclusively through a real proxy) — this makes per-IP limiting evadable in that configuration.
// It's a coarse throttle on its own (there's no per-email limit in this app to layer it under),
// not a hard guarantee — see the module-level comment above for the broader caveat.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}
