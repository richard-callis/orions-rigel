-- The original index was unique on (roomCode, isActive) unconditionally,
-- which also forbids two ENDED sessions from ever sharing a room code —
-- guaranteed to happen the moment a course runs more than once, or the
-- moment a live session advances through more than one module (advance
-- creates a new active row with the same roomCode as the one it just set
-- isActive=false, and any FUTURE advance/end on that same code collides
-- with the first ended row). Replace with a true partial unique index:
-- only ACTIVE sessions need a unique room code.
DROP INDEX IF EXISTS "LiveSession_roomCode_isActive_key";

CREATE UNIQUE INDEX "LiveSession_roomCode_active_key" ON "LiveSession"("roomCode") WHERE "isActive" = true;

-- Non-unique index so lookups by ended room codes (replay/history) stay fast.
CREATE INDEX "LiveSession_roomCode_isActive_idx" ON "LiveSession"("roomCode", "isActive");
