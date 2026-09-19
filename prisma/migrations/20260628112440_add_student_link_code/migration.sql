-- CreateTable
CREATE TABLE "student_link_codes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_link_codes_studentId_idx" ON "student_link_codes"("studentId");

-- CreateIndex
CREATE INDEX "student_link_codes_schoolId_idx" ON "student_link_codes"("schoolId");

-- AddForeignKey
ALTER TABLE "student_link_codes" ADD CONSTRAINT "student_link_codes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

