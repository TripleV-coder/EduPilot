-- CreateTable
CREATE TABLE "alumni" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "series" TEXT,
    "field" TEXT NOT NULL DEFAULT 'Autre',
    "currentRole" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isMentor" BOOLEAN NOT NULL DEFAULT false,
    "mentorTopic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumni_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alumni_schoolId_idx" ON "alumni"("schoolId");

-- CreateIndex
CREATE INDEX "alumni_schoolId_graduationYear_idx" ON "alumni"("schoolId", "graduationYear");

-- CreateIndex
CREATE INDEX "alumni_schoolId_field_idx" ON "alumni"("schoolId", "field");

-- AddForeignKey
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

