-- End any sessions left dangling as isActive from before this migration —
-- they predate room codes and were test/orphaned sessions, not real
-- classes in progress.
UPDATE "LiveSession" SET "isActive" = false, "endedAt" = COALESCE("endedAt", now())
WHERE "isActive" = true;

-- AlterTable: add roomCode as nullable first, backfill, then enforce NOT NULL.
ALTER TABLE "LiveSession" ADD COLUMN "roomCode" TEXT;

-- Backfill any historical rows with a placeholder unique code derived from
-- their id — these are ended sessions, so the room code is never actually
-- used to join anything at this point, it only needs to satisfy the
-- NOT NULL/unique constraints.
UPDATE "LiveSession" SET "roomCode" = 'LEGACY-' || substr(id, 1, 8) WHERE "roomCode" IS NULL;

ALTER TABLE "LiveSession" ALTER COLUMN "roomCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN "attendedLive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_roomCode_isActive_key" ON "LiveSession"("roomCode", "isActive");

-- CreateTable
CREATE TABLE "LiveSessionAttendance" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reachedSlide" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveSessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionAttendance_liveSessionId_userId_key" ON "LiveSessionAttendance"("liveSessionId", "userId");

-- CreateIndex
CREATE INDEX "LiveSessionAttendance_userId_idx" ON "LiveSessionAttendance"("userId");

-- AddForeignKey
ALTER TABLE "LiveSessionAttendance" ADD CONSTRAINT "LiveSessionAttendance_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAttendance" ADD CONSTRAINT "LiveSessionAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
