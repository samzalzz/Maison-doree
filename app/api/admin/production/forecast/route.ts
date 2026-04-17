import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withAdminAuth } from '@/lib/auth-middleware'
import type { ForecastResponse } from '@/lib/types-production'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DAYS = 7
const MAX_DAYS = 30
const LOOKBACK_DAYS = 30 // how many historical days to analyse

// ---------------------------------------------------------------------------
// Rolling-average helpers
// ---------------------------------------------------------------------------

/**
 * Returns the sum of quantities completed for a given recipe across the
 * supplied batches, bucketed by UTC calendar date (YYYY-MM-DD string).
 */
function buildDailyTotals(
  batches: Array<{ quantity: number; actualCompletionTime: Date | null }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of batches) {
    if (!b.actualCompletionTime) continue
    const key = b.actualCompletionTime.toISOString().slice(0, 10)
    map.set(key, (map.get(key) ?? 0) + b.quantity)
  }
  return map
}

/**
 * Calculates the average daily quantity over the last `windowDays` calendar
 * days relative to `referenceDate`, using only days that appear in the
 * `dailyTotals` map (i.e. days with at least one completed batch).
 *
 * Returns null when there are no data points in the window.
 */
function rollingAverage(
  dailyTotals: Map<string, number>,
  referenceDate: Date,
  windowDays: number,
): number | null {
  let sum = 0
  let count = 0
  for (let i = 1; i <= windowDays; i++) {
    const d = new Date(referenceDate)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    const qty = dailyTotals.get(key)
    if (qty !== undefined) {
      sum += qty
      count++
    }
  }
  return count === 0 ? null : Math.round(sum / count)
}

/**
 * Derives a confidence score (0–100) from the number of distinct days with
 * production data in the lookback window:
 *   <  3 days  → 40  (low)
 *    3–14 days → 70  (medium)
 *   15+ days   → 90  (high)
 *    0 days    →  0  (no data)
 */
function calcConfidence(daysWithData: number): number {
  if (daysWithData === 0) return 0
  if (daysWithData < 3) return 40
  if (daysWithData <= 14) return 70
  return 90
}

// ---------------------------------------------------------------------------
// GET /api/admin/production/forecast
// ---------------------------------------------------------------------------

export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    // ------------------------------------------------------------------
    // 1. Parse & validate query parameters
    // ------------------------------------------------------------------
    const { searchParams } = new URL(req.url)

    const daysRaw = parseInt(searchParams.get('days') ?? String(DEFAULT_DAYS), 10)
    const days = Number.isNaN(daysRaw) || daysRaw < 1 ? DEFAULT_DAYS : Math.min(daysRaw, MAX_DAYS)

    const recipeIdFilter = searchParams.get('recipeId') ?? undefined

    // ------------------------------------------------------------------
    // 2. Fetch completed batches from last LOOKBACK_DAYS days
    // ------------------------------------------------------------------
    const lookbackStart = new Date()
    lookbackStart.setUTCDate(lookbackStart.getUTCDate() - LOOKBACK_DAYS)
    lookbackStart.setUTCHours(0, 0, 0, 0)

    const batches = await prisma.productionBatch.findMany({
      where: {
        status: 'COMPLETED',
        actualCompletionTime: { gte: lookbackStart },
        ...(recipeIdFilter ? { recipeId: recipeIdFilter } : {}),
      },
      select: {
        recipeId: true,
        quantity: true,
        actualCompletionTime: true,
        recipe: { select: { id: true, name: true } },
      },
    })

    // ------------------------------------------------------------------
    // 3. Determine the set of recipes to forecast
    // ------------------------------------------------------------------
    let recipes: Array<{ id: string; name: string }>

    if (recipeIdFilter) {
      // Always include the requested recipe even if no historical data exists
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeIdFilter },
        select: { id: true, name: true },
      })
      if (!recipe) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Recipe not found.' } },
          { status: 404 },
        )
      }
      recipes = [recipe]
    } else {
      // All recipes that appear in the historical data
      const seen = new Map<string, { id: string; name: string }>()
      for (const b of batches) {
        if (!seen.has(b.recipeId)) seen.set(b.recipeId, b.recipe)
      }

      // Also include every other recipe (zero-confidence rows) so operators
      // can see them on the dashboard.
      const allRecipes = await prisma.recipe.findMany({
        select: { id: true, name: true },
      })
      for (const r of allRecipes) {
        if (!seen.has(r.id)) seen.set(r.id, r)
      }

      recipes = Array.from(seen.values())
    }

    // ------------------------------------------------------------------
    // 4. Build per-recipe metrics then generate daily forecasts
    // ------------------------------------------------------------------
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const results: ForecastResponse[] = []

    // Prepare upsert payloads for bulk persistence
    const upsertPayloads: Array<{
      date: Date
      recipeId: string
      predictedQuantity: number
      confidence: number
      reasoning: string
      sevenDayAverage: number | null
      fourteenDayAverage: number | null
      thirtyDayAverage: number | null
    }> = []

    for (const recipe of recipes) {
      const recipeBatches = batches.filter((b) => b.recipeId === recipe.id)

      const dailyTotals = buildDailyTotals(recipeBatches)
      const daysWithData = dailyTotals.size

      const avg7 = rollingAverage(dailyTotals, today, 7)
      const avg14 = rollingAverage(dailyTotals, today, 14)
      const avg30 = rollingAverage(dailyTotals, today, LOOKBACK_DAYS)

      const confidence = calcConfidence(daysWithData)
      const predictedQuantity = avg7 ?? 0

      const reasoning =
        daysWithData === 0
          ? 'No historical data'
          : `Based on 7-day average of ${predictedQuantity} units/day`

      // Generate one row per forecast day
      for (let i = 1; i <= days; i++) {
        const forecastDate = new Date(today)
        forecastDate.setUTCDate(forecastDate.getUTCDate() + i)
        // Normalise to midnight UTC (the @db.Date column stores date-only)
        forecastDate.setUTCHours(0, 0, 0, 0)

        results.push({
          date: forecastDate,
          recipeId: recipe.id,
          recipe: { id: recipe.id, name: recipe.name },
          predictedQuantity,
          confidence,
          reasoning,
          sevenDayAverage: avg7 ?? undefined,
          fourteenDayAverage: avg14 ?? undefined,
          thirtyDayAverage: avg30 ?? undefined,
        })

        upsertPayloads.push({
          date: forecastDate,
          recipeId: recipe.id,
          predictedQuantity,
          confidence,
          reasoning,
          sevenDayAverage: avg7,
          fourteenDayAverage: avg14,
          thirtyDayAverage: avg30,
        })
      }
    }

    // ------------------------------------------------------------------
    // 5. Persist forecasts (upsert) for historical reference
    // ------------------------------------------------------------------
    await Promise.all(
      upsertPayloads.map((p) =>
        prisma.dailyForecast.upsert({
          where: { date_recipeId: { date: p.date, recipeId: p.recipeId } },
          create: {
            date: p.date,
            recipeId: p.recipeId,
            predictedQuantity: p.predictedQuantity,
            confidence: p.confidence,
            reasoning: p.reasoning,
            sevenDayAverage: p.sevenDayAverage,
            fourteenDayAverage: p.fourteenDayAverage,
            thirtyDayAverage: p.thirtyDayAverage,
          },
          update: {
            predictedQuantity: p.predictedQuantity,
            confidence: p.confidence,
            reasoning: p.reasoning,
            sevenDayAverage: p.sevenDayAverage,
            fourteenDayAverage: p.fourteenDayAverage,
            thirtyDayAverage: p.thirtyDayAverage,
          },
        }),
      ),
    )

    // ------------------------------------------------------------------
    // 6. Sort results by date ASC, then recipe name ASC
    // ------------------------------------------------------------------
    results.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime()
      if (dateDiff !== 0) return dateDiff
      return a.recipe.name.localeCompare(b.recipe.name)
    })

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    console.error('[forecast] Unexpected error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while generating forecasts.',
        },
      },
      { status: 500 },
    )
  }
})
