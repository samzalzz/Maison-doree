/**
 * Transfer Suggester
 *
 * Analyses current lab stock levels against 7-day forecast demand to produce
 * predictive inter-lab transfer recommendations.
 *
 * Algorithm:
 *  1. For each ProductionLab, compute available surplus per raw material:
 *       available = current_stock - 7_day_forecast_demand
 *  2. A lab is a *source candidate* for a material when:
 *       available > 50 % of current stock  (excess threshold)
 *  3. For every other lab whose forecast demand exceeds its current stock,
 *     create a TransferSuggestion directed from the source to the deficit lab.
 *  4. Persist new suggestions with status "pending".
 *  5. Return the persisted suggestion records.
 *
 * The function is idempotent in the sense that it only creates suggestions
 * where no non-expired pending suggestion already exists for the same
 * (sourceLab, destLab, material) triple.
 */

import { prisma } from '@/lib/db/prisma'
import type { TransferSuggestion } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of forecast days used to estimate demand. */
const FORECAST_WINDOW_DAYS = 7

/** How many days a suggestion stays valid before it expires. */
const SUGGESTION_TTL_DAYS = 7

/**
 * A source lab is considered to have "excess" stock when the remaining
 * quantity after meeting forecast demand exceeds this fraction of current
 * stock.  0.5 = 50 %.
 */
const EXCESS_THRESHOLD_RATIO = 0.5

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

type LabStockRow = {
  labId: string
  materialId: string
  quantity: Decimal
}

type ForecastDemand = {
  recipeId: string
  materialId: string
  demandPerDay: number
  totalDemand: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a map of materialId → total forecasted demand (units) across the
 * next FORECAST_WINDOW_DAYS days for a given lab's active recipes.
 *
 * The approach:
 *  - Fetch completed batches from the last 30 days for recipes that ran in
 *    the lab.
 *  - Compute 7-day rolling average per recipe as a demand proxy.
 *  - Multiply by the ingredient quantities in those recipes to get material
 *    demand totals.
 */
async function buildLabDemandMap(
  labId: string,
): Promise<Map<string, number>> {
  const lookbackStart = new Date()
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - 30)
  lookbackStart.setUTCHours(0, 0, 0, 0)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // 1. Fetch recent completed batches from this lab to derive recipe activity
  const batches = await prisma.productionBatch.findMany({
    where: {
      labId,
      status: 'COMPLETED',
      actualCompletionTime: { gte: lookbackStart },
    },
    select: {
      recipeId: true,
      quantity: true,
      actualCompletionTime: true,
    },
  })

  // 2. Compute 7-day rolling average per recipe
  const recipeAverages = new Map<string, number>()
  const recipeIds = [...new Set(batches.map((b) => b.recipeId))]

  for (const recipeId of recipeIds) {
    const recipeBatches = batches.filter((b) => b.recipeId === recipeId)

    // Group by calendar day
    const dailyMap = new Map<string, number>()
    for (const b of recipeBatches) {
      if (!b.actualCompletionTime) continue
      const key = b.actualCompletionTime.toISOString().slice(0, 10)
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + b.quantity)
    }

    // Rolling 7-day average
    let sum = 0
    let count = 0
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - i)
      const qty = dailyMap.get(d.toISOString().slice(0, 10))
      if (qty !== undefined) {
        sum += qty
        count++
      }
    }

    recipeAverages.set(recipeId, count === 0 ? 0 : Math.round(sum / count))
  }

  if (recipeAverages.size === 0) return new Map()

  // 3. Expand recipe averages into per-material demand using recipe ingredients
  const ingredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: recipeIds } },
    select: {
      recipeId: true,
      rawMaterialId: true,
      quantity: true,
    },
  })

  const demandMap = new Map<string, number>()

  for (const ing of ingredients) {
    if (!ing.rawMaterialId) continue // skip intermediate sub-recipes

    const avgBatchesPerDay = recipeAverages.get(ing.recipeId) ?? 0
    const ingredientQtyPerBatch = Number(ing.quantity)
    const totalDemand = avgBatchesPerDay * ingredientQtyPerBatch * FORECAST_WINDOW_DAYS

    demandMap.set(
      ing.rawMaterialId,
      (demandMap.get(ing.rawMaterialId) ?? 0) + totalDemand,
    )
  }

  return demandMap
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SuggestTransfersResult = {
  created: number
  suggestions: TransferSuggestion[]
}

/**
 * Runs the transfer suggestion algorithm and persists new recommendations.
 *
 * Call this from a scheduled job or from the GET endpoint to refresh
 * suggestions on demand.
 */
export async function suggestTransfers(): Promise<SuggestTransfersResult> {
  // -------------------------------------------------------------------------
  // 1. Load all labs with their current stock
  // -------------------------------------------------------------------------
  const labs = await prisma.productionLab.findMany({
    select: { id: true, name: true },
  })

  if (labs.length < 2) {
    // Cannot suggest transfers with fewer than 2 labs
    return { created: 0, suggestions: [] }
  }

  const allStock = await prisma.labStock.findMany({
    select: { labId: true, materialId: true, quantity: true },
  })

  // Index stock as labId → materialId → quantity
  const stockIndex = new Map<string, Map<string, Decimal>>()
  for (const s of allStock) {
    if (!stockIndex.has(s.labId)) stockIndex.set(s.labId, new Map())
    stockIndex.get(s.labId)!.set(s.materialId, s.quantity)
  }

  // -------------------------------------------------------------------------
  // 2. Build demand maps for every lab
  // -------------------------------------------------------------------------
  const labDemandMaps = new Map<string, Map<string, number>>()
  for (const lab of labs) {
    labDemandMaps.set(lab.id, await buildLabDemandMap(lab.id))
  }

  // -------------------------------------------------------------------------
  // 3. For each lab, find materials with surplus ( available > 50 % of stock )
  //    then check every other lab for a corresponding deficit.
  // -------------------------------------------------------------------------
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setUTCDate(expiresAt.getUTCDate() + SUGGESTION_TTL_DAYS)

  // Pre-load existing non-expired pending suggestions to avoid duplicates
  const existingSuggestions = await prisma.transferSuggestion.findMany({
    where: {
      status: 'pending',
      expiresAt: { gt: now },
    },
    select: { sourceLabId: true, destLabId: true, materialId: true },
  })

  const existingKeys = new Set(
    existingSuggestions.map(
      (s) => `${s.sourceLabId}:${s.destLabId}:${s.materialId}`,
    ),
  )

  const toCreate: Array<Parameters<typeof prisma.transferSuggestion.create>[0]['data']> = []

  for (const sourceLab of labs) {
    const sourceStock = stockIndex.get(sourceLab.id) ?? new Map()
    const sourceDemand = labDemandMaps.get(sourceLab.id) ?? new Map()

    for (const [materialId, currentQty] of sourceStock) {
      const currentQtyNum = Number(currentQty)
      if (currentQtyNum <= 0) continue

      const forecastDemand = sourceDemand.get(materialId) ?? 0
      const available = currentQtyNum - forecastDemand

      // Source lab only has surplus when available > EXCESS_THRESHOLD_RATIO of current
      if (available <= currentQtyNum * EXCESS_THRESHOLD_RATIO) continue

      // Check every other lab for a deficit
      for (const destLab of labs) {
        if (destLab.id === sourceLab.id) continue

        const destStock = stockIndex.get(destLab.id) ?? new Map()
        const destCurrentQty = Number(destStock.get(materialId) ?? 0)
        const destForecastDemand = labDemandMaps.get(destLab.id)?.get(materialId) ?? 0

        // Destination lab has a deficit when forecast demand exceeds current stock
        if (destForecastDemand <= destCurrentQty) continue

        const deficit = destForecastDemand - destCurrentQty

        // Avoid duplicate pending suggestions
        const key = `${sourceLab.id}:${destLab.id}:${materialId}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)

        const suggestedQty = Math.min(available * 0.5, deficit)
        if (suggestedQty <= 0) continue

        // Fetch material name for the reasoning string
        const material = await prisma.rawMaterial.findUnique({
          where: { id: materialId },
          select: { name: true, unit: true },
        })
        const materialLabel = material
          ? `${material.name} (${material.unit})`
          : materialId

        toCreate.push({
          sourceLabId: sourceLab.id,
          destLabId: destLab.id,
          materialId,
          suggestedQuantity: new Decimal(suggestedQty.toFixed(2)),
          reasoning: `${destLab.name} is predicted to need ${destForecastDemand.toFixed(1)} ${material?.unit ?? 'units'} of ${materialLabel} over the next ${FORECAST_WINDOW_DAYS} days but only has ${destCurrentQty.toFixed(1)}. ${sourceLab.name} has a surplus of ${available.toFixed(1)} ${material?.unit ?? 'units'}.`,
          status: 'pending',
          expiresAt,
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Persist new suggestions
  // -------------------------------------------------------------------------
  if (toCreate.length === 0) {
    return { created: 0, suggestions: [] }
  }

  const created = await prisma.$transaction(
    toCreate.map((data) => prisma.transferSuggestion.create({ data })),
  )

  return { created: created.length, suggestions: created }
}
