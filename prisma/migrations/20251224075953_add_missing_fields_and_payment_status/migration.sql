/*
  Warnings:

  - Added the required column `updatedAt` to the `allergies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `emergency_contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `first_login_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `grade_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `installment_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `vaccinations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'RECONCILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "allergies" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "emergency_contacts" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "first_login_tokens" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "grade_history" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "installment_payments" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBy" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "vaccinations" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
