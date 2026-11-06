-- Pulse climat : réponses anonymes agrégées (compteurs) + participation (qui a répondu, jamais quoi).
-- AlterTable
ALTER TABLE "climate_pulse_weeks" ADD COLUMN     "adultYes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "friendYes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "harassYes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "safetyYes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoreSum" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "climate_pulse_participations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "climate_pulse_participations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "climate_pulse_participations_schoolId_weekStart_idx" ON "climate_pulse_participations"("schoolId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "climate_pulse_participations_userId_weekStart_key" ON "climate_pulse_participations"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "climate_pulse_participations" ADD CONSTRAINT "climate_pulse_participations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "climate_pulse_participations" ADD CONSTRAINT "climate_pulse_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Semaines déjà enregistrées : compteurs reconstitués depuis la moyenne et les %
UPDATE "climate_pulse_weeks" SET
  "scoreSum"  = "averageScore" * "responses",
  "safetyYes" = COALESCE(ROUND("pctSafety" * "responses" / 100.0), 0)::INTEGER,
  "friendYes" = COALESCE(ROUND("pctFriend" * "responses" / 100.0), 0)::INTEGER,
  "adultYes"  = COALESCE(ROUND("pctAdultListens" * "responses" / 100.0), 0)::INTEGER,
  "harassYes" = COALESCE(ROUND("pctHarassWitness" * "responses" / 100.0), 0)::INTEGER;
