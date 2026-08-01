/*
  Warnings:

  - You are about to drop the column `sql` on the `SavedQuery` table. All the data in the column will be lost.
  - Added the required column `content` to the `SavedQuery` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SavedQuery" DROP COLUMN "sql",
ADD COLUMN     "content" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "currentSlide" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveQuiz" (
    "id" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "quizKey" TEXT NOT NULL,
    "activatedBy" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ActiveQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizResponse" (
    "id" TEXT NOT NULL,
    "activeQuizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedIndex" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveSession_courseSlug_moduleSlug_isActive_idx" ON "LiveSession"("courseSlug", "moduleSlug", "isActive");

-- CreateIndex
CREATE INDEX "ActiveQuiz_courseSlug_moduleSlug_quizKey_idx" ON "ActiveQuiz"("courseSlug", "moduleSlug", "quizKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuizResponse_activeQuizId_userId_key" ON "QuizResponse"("activeQuizId", "userId");

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_activeQuizId_fkey" FOREIGN KEY ("activeQuizId") REFERENCES "ActiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
