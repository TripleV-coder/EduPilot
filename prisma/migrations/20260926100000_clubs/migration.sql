-- Clubs et adhésions (module « Événements et clubs »). Avant : la page Clubs
-- affichait un catalogue écrit en dur et gardait les inscriptions dans le navigateur.

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "schedule" TEXT,
    "supervisorId" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "club_memberships" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "club_memberships_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "clubs_schoolId_isActive_idx" ON "clubs"("schoolId", "isActive");
-- CreateIndex
CREATE UNIQUE INDEX "clubs_schoolId_name_key" ON "clubs"("schoolId", "name");
-- CreateIndex
CREATE INDEX "club_memberships_studentId_idx" ON "club_memberships"("studentId");
-- CreateIndex
CREATE UNIQUE INDEX "club_memberships_clubId_studentId_key" ON "club_memberships"("clubId", "studentId");
-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
