-- CreateTable
CREATE TABLE "GeneratedCourse" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tagline" TEXT,
    "sandboxType" TEXT NOT NULL DEFAULT 'sql',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "duration" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedCourse_slug_key" ON "GeneratedCourse"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedModule_courseId_slug_key" ON "GeneratedModule"("courseId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedModule_courseId_order_key" ON "GeneratedModule"("courseId", "order");

-- AddForeignKey
ALTER TABLE "GeneratedModule" ADD CONSTRAINT "GeneratedModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GeneratedCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
