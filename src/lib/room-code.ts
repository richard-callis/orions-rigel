// Short, human-typeable codes for joining a live session by hand — avoids
// visually ambiguous characters (0/O, 1/I/L) since these get read aloud and
// typed under time pressure.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Normalize user-typed input for comparison/lookup: uppercase, strip whitespace/dashes. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}
