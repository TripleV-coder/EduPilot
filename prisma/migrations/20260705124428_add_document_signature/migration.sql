-- CreateEnum
CREATE TYPE "SignableDocType" AS ENUM ('REPORT_CARD', 'CERTIFICATE', 'PARENT_AUTHORIZATION', 'STAFF_CONTRACT');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('DRAWN', 'TYPED', 'OTP');

-- CreateTable
CREATE TABLE "document_signatures" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "docType" "SignableDocType" NOT NULL,
    "docId" TEXT NOT NULL,
    "signerId" TEXT,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "method" "SignatureMethod" NOT NULL,
    "signatureData" TEXT,
    "contentHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "meta" JSONB,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_signatures_schoolId_docType_docId_idx" ON "document_signatures"("schoolId", "docType", "docId");

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

