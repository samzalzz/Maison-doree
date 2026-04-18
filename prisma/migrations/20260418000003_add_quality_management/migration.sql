-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('INCOMING', 'IN_PROCESS', 'FINAL');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL');

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "inspectionType" "InspectionType" NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANNED',
    "rawMaterialId" TEXT,
    "productionBatchId" TEXT,
    "supplierId" TEXT,
    "inspectedBy" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionCheckpoint" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,

    CONSTRAINT "InspectionCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QualityInspection_inspectionType_idx" ON "QualityInspection"("inspectionType");

-- CreateIndex
CREATE INDEX "QualityInspection_status_idx" ON "QualityInspection"("status");

-- CreateIndex
CREATE INDEX "QualityInspection_rawMaterialId_idx" ON "QualityInspection"("rawMaterialId");

-- CreateIndex
CREATE INDEX "QualityInspection_productionBatchId_idx" ON "QualityInspection"("productionBatchId");

-- CreateIndex
CREATE INDEX "QualityInspection_supplierId_idx" ON "QualityInspection"("supplierId");

-- CreateIndex
CREATE INDEX "QualityInspection_scheduledDate_idx" ON "QualityInspection"("scheduledDate");

-- CreateIndex
CREATE INDEX "InspectionCheckpoint_inspectionId_idx" ON "InspectionCheckpoint"("inspectionId");

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "ProductionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionCheckpoint" ADD CONSTRAINT "InspectionCheckpoint_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
