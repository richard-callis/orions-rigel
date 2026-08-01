-- CreateTable
CREATE TABLE "SavedQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedQuery_userId_courseSlug_idx" ON "SavedQuery"("userId", "courseSlug");

-- AddForeignKey
ALTER TABLE "SavedQuery" ADD CONSTRAINT "SavedQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
