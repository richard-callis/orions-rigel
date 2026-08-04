-- AlterTable
ALTER TABLE "WeeklyChallenge" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'sql',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
