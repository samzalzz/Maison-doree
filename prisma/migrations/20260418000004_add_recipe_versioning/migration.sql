-- CreateTable
CREATE TABLE "RecipeVersion" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionName" TEXT,
    "description" TEXT,
    "laborMinutes" INTEGER NOT NULL,
    "estimatedCost" DECIMAL(12,2),
    "lastCostUpdate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deprecatedAt" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersionIngredient" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "rawMaterialId" TEXT,
    "intermediateId" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "costPerUnit" DECIMAL(12,4),
    "totalCost" DECIMAL(12,2),
    "notes" TEXT,

    CONSTRAINT "RecipeVersionIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeVersionHistory" (
    "id" TEXT NOT NULL,
    "recipeVersionId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "RecipeVersionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeVersion_recipeId_versionNumber_key" ON "RecipeVersion"("recipeId", "versionNumber");

-- CreateIndex
CREATE INDEX "RecipeVersion_recipeId_idx" ON "RecipeVersion"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeVersion_isActive_idx" ON "RecipeVersion"("isActive");

-- CreateIndex
CREATE INDEX "RecipeVersion_createdAt_idx" ON "RecipeVersion"("createdAt");

-- CreateIndex
CREATE INDEX "RecipeVersionIngredient_recipeVersionId_idx" ON "RecipeVersionIngredient"("recipeVersionId");

-- CreateIndex
CREATE INDEX "RecipeVersionHistory_recipeVersionId_idx" ON "RecipeVersionHistory"("recipeVersionId");

-- CreateIndex
CREATE INDEX "RecipeVersionHistory_changeDate_idx" ON "RecipeVersionHistory"("changeDate");

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersion" ADD CONSTRAINT "RecipeVersion_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "RecipeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionIngredient" ADD CONSTRAINT "RecipeVersionIngredient_intermediateId_fkey" FOREIGN KEY ("intermediateId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeVersionHistory" ADD CONSTRAINT "RecipeVersionHistory_recipeVersionId_fkey" FOREIGN KEY ("recipeVersionId") REFERENCES "RecipeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
