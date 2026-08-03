-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "sessionEvents" JSONB NOT NULL DEFAULT '[]';
