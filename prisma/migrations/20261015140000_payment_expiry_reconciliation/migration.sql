-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerTransactionId" TEXT;

