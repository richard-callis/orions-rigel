import bcrypt from "bcryptjs";

// Shared so signup hashing and login's dummy-hash comparison can never drift apart — a cost
// mismatch between the two directly reopens the timing oracle DUMMY_HASH exists to close (see
// lib/auth.ts).
export const BCRYPT_COST = 12;

// A real hash at BCRYPT_COST, computed once at module load (not hardcoded to a fixed string) so
// it can't silently go stale if BCRYPT_COST ever changes — used by authorize() to run a
// same-cost bcrypt.compare on the "no such user" path, so it takes the same time as a real
// wrong-password attempt instead of being a measurably faster shortcut.
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-only", BCRYPT_COST);
