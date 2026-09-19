-- Add parent school relation for organization/annex hierarchy
ALTER TABLE "schools" ADD COLUMN "parentSchoolId" TEXT;

ALTER TABLE "schools"
ADD CONSTRAINT "schools_parentSchoolId_fkey"
FOREIGN KEY ("parentSchoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "schools_parentSchoolId_idx" ON "schools"("parentSchoolId");
