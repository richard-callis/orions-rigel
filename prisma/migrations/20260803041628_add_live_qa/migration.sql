-- CreateTable
CREATE TABLE "LiveQuestion" (
    "id" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveQuestionUpvote" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LiveQuestionUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveQuestion_courseSlug_moduleSlug_answered_idx" ON "LiveQuestion"("courseSlug", "moduleSlug", "answered");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuestionUpvote_questionId_userId_key" ON "LiveQuestionUpvote"("questionId", "userId");

-- AddForeignKey
ALTER TABLE "LiveQuestionUpvote" ADD CONSTRAINT "LiveQuestionUpvote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "LiveQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
