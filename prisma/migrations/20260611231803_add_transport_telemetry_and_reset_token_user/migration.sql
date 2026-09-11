-- CreateEnum
CREATE TYPE "TransportLineStatus" AS ENUM ('ON_TIME', 'DELAYED', 'INCIDENT', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TransportDirection" AS ENUM ('OUTBOUND', 'RETURN', 'BOTH');

-- AlterTable
ALTER TABLE "password_reset_tokens" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "transport_lines" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "TransportDirection" NOT NULL DEFAULT 'BOTH',
    "status" "TransportLineStatus" NOT NULL DEFAULT 'ON_TIME',
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "lineId" TEXT,
    "plateNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_routes" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scheduledTime" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "bus_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_transports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "stopId" TEXT,
    "direction" "TransportDirection" NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" TEXT,
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "pathname" TEXT,
    "userId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_lines_schoolId_isActive_idx" ON "transport_lines"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "transport_lines_schoolId_number_key" ON "transport_lines"("schoolId", "number");

-- CreateIndex
CREATE INDEX "buses_schoolId_isActive_idx" ON "buses"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "buses_schoolId_plateNumber_key" ON "buses"("schoolId", "plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bus_routes_lineId_order_key" ON "bus_routes"("lineId", "order");

-- CreateIndex
CREATE INDEX "student_transports_lineId_isActive_idx" ON "student_transports"("lineId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "student_transports_studentId_lineId_key" ON "student_transports"("studentId", "lineId");

-- CreateIndex
CREATE INDEX "performance_metrics_metric_createdAt_idx" ON "performance_metrics"("metric", "createdAt");

-- CreateIndex
CREATE INDEX "performance_metrics_createdAt_idx" ON "performance_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "telemetry_events_event_createdAt_idx" ON "telemetry_events"("event", "createdAt");

-- CreateIndex
CREATE INDEX "telemetry_events_createdAt_idx" ON "telemetry_events"("createdAt");

-- CreateIndex
CREATE INDEX "announcements_deletedAt_idx" ON "announcements"("deletedAt");

-- CreateIndex
CREATE INDEX "classes_deletedAt_idx" ON "classes"("deletedAt");

-- CreateIndex
CREATE INDEX "enrollments_deletedAt_idx" ON "enrollments"("deletedAt");

-- CreateIndex
CREATE INDEX "fees_deletedAt_idx" ON "fees"("deletedAt");

-- CreateIndex
CREATE INDEX "grades_deletedAt_idx" ON "grades"("deletedAt");

-- CreateIndex
CREATE INDEX "homeworks_deletedAt_idx" ON "homeworks"("deletedAt");

-- CreateIndex
CREATE INDEX "meal_tickets_deletedAt_idx" ON "meal_tickets"("deletedAt");

-- CreateIndex
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");

-- CreateIndex
CREATE INDEX "payments_deletedAt_idx" ON "payments"("deletedAt");

-- CreateIndex
CREATE INDEX "resources_deletedAt_idx" ON "resources"("deletedAt");

-- CreateIndex
CREATE INDEX "student_profiles_deletedAt_idx" ON "student_profiles"("deletedAt");

-- CreateIndex
CREATE INDEX "subjects_deletedAt_idx" ON "subjects"("deletedAt");

-- CreateIndex
CREATE INDEX "teacher_profiles_deletedAt_idx" ON "teacher_profiles"("deletedAt");

-- AddForeignKey
ALTER TABLE "transport_lines" ADD CONSTRAINT "transport_lines_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buses" ADD CONSTRAINT "buses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buses" ADD CONSTRAINT "buses_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "transport_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_routes" ADD CONSTRAINT "bus_routes_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "transport_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "transport_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "bus_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
