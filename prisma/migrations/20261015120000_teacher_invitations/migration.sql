-- CreateTable
CREATE TABLE "teacher_invitations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teacher_invitations_codeHash_key" ON "teacher_invitations"("codeHash");

-- CreateIndex
CREATE INDEX "teacher_invitations_schoolId_usedAt_idx" ON "teacher_invitations"("schoolId", "usedAt");

-- AddForeignKey
ALTER TABLE "teacher_invitations" ADD CONSTRAINT "teacher_invitations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

