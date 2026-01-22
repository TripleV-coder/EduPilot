-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('LATE', 'ABSENCE_UNEXCUSED', 'DISRESPECT', 'DISRUPTION', 'CHEATING', 'BULLYING', 'VIOLENCE', 'VANDALISM', 'THEFT', 'SUBSTANCE', 'INAPPROPRIATE_LANGUAGE', 'DRESS_CODE', 'TECHNOLOGY_MISUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SanctionType" AS ENUM ('WARNING', 'DETENTION', 'SUSPENSION', 'EXPULSION', 'COMMUNITY_SERVICE', 'LOSS_OF_PRIVILEGE', 'PARENT_CONFERENCE', 'COUNSELING', 'OTHER');

-- CreateTable
CREATE TABLE "behavior_incidents" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "incidentType" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "followUpNotes" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "behavior_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanctions" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "SanctionType" NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isServed" BOOLEAN NOT NULL DEFAULT false,
    "servedAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "behavior_incidents_studentId_date_idx" ON "behavior_incidents"("studentId", "date");

-- CreateIndex
CREATE INDEX "behavior_incidents_incidentType_idx" ON "behavior_incidents"("incidentType");

-- CreateIndex
CREATE INDEX "behavior_incidents_severity_idx" ON "behavior_incidents"("severity");

-- CreateIndex
CREATE INDEX "sanctions_incidentId_idx" ON "sanctions"("incidentId");

-- CreateIndex
CREATE INDEX "sanctions_startDate_idx" ON "sanctions"("startDate");

-- AddForeignKey
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "behavior_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
