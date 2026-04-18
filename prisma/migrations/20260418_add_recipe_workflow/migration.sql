-- CreateTable: RecipeWorkflow
-- Stores the production workflow (as JSON steps) for each recipe.
-- Uses @unique on recipeId so each recipe has at most one workflow.

CREATE TABLE "RecipeWorkflow" (
    "id"        TEXT NOT NULL,
    "recipeId"  TEXT NOT NULL,
    "steps"     TEXT NOT NULL,
    "labId"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeWorkflow_recipeId_key" ON "RecipeWorkflow"("recipeId");
CREATE INDEX "RecipeWorkflow_recipeId_idx" ON "RecipeWorkflow"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipeWorkflow"
    ADD CONSTRAINT "RecipeWorkflow_recipeId_fkey"
    FOREIGN KEY ("recipeId")
    REFERENCES "Recipe"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
