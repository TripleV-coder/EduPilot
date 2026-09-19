-- AddForeignKey: StudentProfile.schoolId → School
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: TeacherProfile.schoolId → School
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Payment.receivedBy → User
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Payment.reconciledBy → User
ALTER TABLE "payments" ADD CONSTRAINT "payments_reconciledBy_fkey" FOREIGN KEY ("reconciledBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: Payment.status for reporting queries
CREATE INDEX "payments_status_idx" ON "payments"("status");
