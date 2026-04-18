-- CreateEnum
CREATE TYPE "MRPSuggestionStatus" AS ENUM ('PENDING', 'ORDERED', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TraceabilityEventType" AS ENUM ('MATERIAL_ALLOCATED', 'PRODUCTION_STARTED', 'PRODUCTION_COMPLETED', 'SHIPPED', 'RECALL');

-- CreateTable
CREATE TABLE "EnhancedForecast" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "recipeId" TEXT NOT NULL,
    "predictedQuantity" INTEGER NOT NULL,
    "confidenceLevel" INTEGER NOT NULL,
    "sevenDayAvg" DECIMAL(10,2),
    "thirtyDayAvg" DECIMAL(10,2),
    "seasonalFactor" DECIMAL(10,4),
    "dayOfWeekPattern" DECIMAL(10,4),
    "mlPrediction" INTEGER,
    "mlConfidence" INTEGER,
    "algorithm" TEXT NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnhancedForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MRPSuggestion" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT,
    "currentStock" DECIMAL(10,2) NOT NULL,
    "minThreshold" DECIMAL(10,2) NOT NULL,
    "maxCapacity" DECIMAL(10,2),
    "projectedUsage" DECIMAL(10,2) NOT NULL,
    "projectedDate" TIMESTAMP(3) NOT NULL,
    "recommendedQty" DECIMAL(10,2) NOT NULL,
    "status" "MRPSuggestionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,

    CONSTRAINT "MRPSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialAllocation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "allocatedQty" DECIMAL(10,2) NOT NULL,
    "actualQty" DECIMAL(10,2),
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceabilityRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "event" "TraceabilityEventType" NOT NULL,
    "details" TEXT NOT NULL,
    "location" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "TraceabilityRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnhancedForecast_date_recipeId_key" ON "EnhancedForecast"("date", "recipeId");

-- CreateIndex
CREATE INDEX "EnhancedForecast_date_idx" ON "EnhancedForecast"("date");

-- CreateIndex
CREATE INDEX "EnhancedForecast_recipeId_idx" ON "EnhancedForecast"("recipeId");

-- CreateIndex
CREATE INDEX "MRPSuggestion_materialId_idx" ON "MRPSuggestion"("materialId");

-- CreateIndex
CREATE INDEX "MRPSuggestion_status_idx" ON "MRPSuggestion"("status");

-- CreateIndex
CREATE INDEX "MRPSuggestion_projectedDate_idx" ON "MRPSuggestion"("projectedDate");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialAllocation_batchId_materialId_key" ON "MaterialAllocation"("batchId", "materialId");

-- CreateIndex
CREATE INDEX "MaterialAllocation_batchId_idx" ON "MaterialAllocation"("batchId");

-- CreateIndex
CREATE INDEX "TraceabilityRecord_batchId_idx" ON "TraceabilityRecord"("batchId");

-- CreateIndex
CREATE INDEX "TraceabilityRecord_timestamp_idx" ON "TraceabilityRecord"("timestamp");

-- AddForeignKey
ALTER TABLE "EnhancedForecast" ADD CONSTRAINT "EnhancedForecast_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRPSuggestion" ADD CONSTRAINT "MRPSuggestion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MRPSuggestion" ADD CONSTRAINT "MRPSuggestion_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAllocation" ADD CONSTRAINT "MaterialAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialAllocation" ADD CONSTRAINT "MaterialAllocation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceabilityRecord" ADD CONSTRAINT "TraceabilityRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
