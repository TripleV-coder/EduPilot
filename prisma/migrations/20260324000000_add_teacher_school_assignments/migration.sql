CREATE TYPE "TeacherAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

CREATE TABLE "teacher_school_assignments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "TeacherAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_school_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_school_assignments_teacherId_schoolId_key"
ON "teacher_school_assignments"("teacherId", "schoolId");

CREATE UNIQUE INDEX "teacher_school_assignments_userId_schoolId_key"
ON "teacher_school_assignments"("userId", "schoolId");

CREATE INDEX "teacher_school_assignments_schoolId_status_idx"
ON "teacher_school_assignments"("schoolId", "status");

CREATE INDEX "teacher_school_assignments_teacherId_status_idx"
ON "teacher_school_assignments"("teacherId", "status");

CREATE INDEX "teacher_school_assignments_userId_status_idx"
ON "teacher_school_assignments"("userId", "status");

ALTER TABLE "teacher_school_assignments"
ADD CONSTRAINT "teacher_school_assignments_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_school_assignments"
ADD CONSTRAINT "teacher_school_assignments_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_school_assignments"
ADD CONSTRAINT "teacher_school_assignments_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "teacher_school_assignments" (
    "id",
    "teacherId",
    "userId",
    "schoolId",
    "status",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('tsa_', md5(tp."id" || ':' || tp."schoolId")),
    tp."id",
    tp."userId",
    tp."schoolId",
    'ACTIVE'::"TeacherAssignmentStatus",
    true,
    COALESCE(tp."createdAt", CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM "teacher_profiles" tp
WHERE tp."schoolId" IS NOT NULL
ON CONFLICT ("teacherId", "schoolId") DO NOTHING;
